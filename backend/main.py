"""
Tehran Real Estate Price Prediction — FastAPI Backend
backend/main.py

Deployed on Render.com / Hugging Face Spaces (standard Python server).
No size limits — uses full google-cloud-bigquery SDK and pandas.

Endpoints:
  GET  /          → health check
  GET  /health    → detailed health status
  POST /predict   → property price prediction
"""

import json
import os
import math
import traceback
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────
TEHRAN_CBD_LON = 51.4183
TEHRAN_CBD_LAT = 35.6961

BQ_DATASET = "siavak-temp-aliz.divar_ml_data_prepration"

FALLBACK_DIST_MAX     = 10000.0
FALLBACK_COMM_DENSITY = 0
FALLBACK_URBAN_DECAY  = 2
FALLBACK_AIR_QUALITY  = 100
FALLBACK_TRAFFIC_ZONE = 1
FALLBACK_SEISMIC_RISK = 3

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

# ─────────────────────────────────────────────────────────
# MODEL CACHE  (loaded once at startup via lifespan)
# ─────────────────────────────────────────────────────────
_cache: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load XGBoost models and neighborhood encoding at startup."""
    print("[startup] Loading models...")
    try:
        macro = xgb.Booster()
        macro.load_model(os.path.join(MODELS_DIR, "macro_clean_model.json"))

        micro = xgb.Booster()
        micro.load_model(os.path.join(MODELS_DIR, "micro_model.json"))

        with open(os.path.join(MODELS_DIR, "neighborhood_encoding.json"), encoding="utf-8") as f:
            enc = json.load(f)

        _cache["macro"] = macro
        _cache["micro"] = micro
        _cache["encoding"] = enc
        print("[startup] ✅ Models loaded successfully.")
    except FileNotFoundError as e:
        print(f"[startup] ⚠️  Model files not found: {e}")
        print("[startup]    Place model files in backend/models/ before predicting.")
    yield
    _cache.clear()
    print("[shutdown] Models cleared.")


# ─────────────────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────────────────
app = FastAPI(
    title="Tehran Real Estate Price Predictor API",
    description=(
        "Two-stage XGBoost ML pipeline: Macro model (base price/m²) + "
        "Micro model (quality ratio), powered by BigQuery spatial inference "
        "and live economic data from tgju.org."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Vercel frontend + local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    lat: float = Field(..., ge=35.5, le=35.9, description="Latitude (Tehran range)")
    lon: float = Field(..., ge=51.1, le=51.8, description="Longitude (Tehran range)")
    area: float = Field(..., gt=10, le=5000, description="Building area in m²")
    building_age: int = Field(default=10, ge=0, le=100)
    total_floors: int = Field(default=6, ge=1, le=60)
    floor_num: int = Field(default=2, ge=0, le=60)
    unit_per_floor: int = Field(default=2, ge=1, le=20)
    rooms_count: int = Field(default=2, ge=1, le=20)
    has_elevator: bool = True
    has_parking: bool = True
    has_warehouse: bool = False
    is_rebuilt: bool = False
    is_villa: bool = False


class SpatialFeatures(BaseModel):
    dist_to_metro_m: float
    dist_to_cbd_m: float
    dist_to_highway_m: float
    commercial_density: int
    seismic_risk_level: int
    air_quality_aqi: float
    traffic_zone_status: int
    urban_decay_class: int


class PredictResponse(BaseModel):
    base_price_per_sqm: float
    quality_ratio: float
    final_price_per_sqm: float
    final_total_price: float
    usd_rate: float
    tedpix: float
    neighborhood: str
    neighborhood_name: str
    region_id: int
    year_jalali: int
    spatial: SpatialFeatures


# ─────────────────────────────────────────────────────────
# SECTION A: Live scraping
# ─────────────────────────────────────────────────────────
def scrape_live_rates() -> dict:
    """Scrape live USD free-market rate and TEDPIX from tgju.org."""
    result = {"usd": None, "tedpix": None}
    try:
        import requests
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
        }

        for key, url in [
            ("usd",    "https://www.tgju.org/profile/price_dollar_rl"),
            ("tedpix", "https://www.tgju.org/profile/tedpix"),
        ]:
            try:
                resp = requests.get(url, headers=headers, timeout=8)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    tag = soup.find("span", {"data-col": "info_price_rial"})
                    if tag and tag.get("data-value"):
                        result[key] = float(tag["data-value"].replace(",", "").strip())
                    else:
                        for t in soup.select(
                            ".market-profile-primary-price strong, .info-price"
                        ):
                            text = t.get_text(strip=True).replace(",", "")
                            try:
                                val = float("".join(c for c in text if c.isdigit() or c == "."))
                                if val > 100_000:
                                    result[key] = val
                                    break
                            except ValueError:
                                continue
            except Exception as e:
                print(f"[scrape] {key} failed: {e}")
    except Exception as e:
        print(f"[scrape] outer error: {e}")
    return result


# ─────────────────────────────────────────────────────────
# SECTION B: BigQuery helpers (full SDK — no size limits!)
# ─────────────────────────────────────────────────────────
def get_bq_client():
    from google.cloud import bigquery

    # Cloud Run: uses Application Default Credentials (ADC) automatically.
    # The service account attached to the Cloud Run revision must have
    # roles/bigquery.dataViewer (or broader) granted in IAM.
    return bigquery.Client(project="siavak-temp-aliz")


def _tbl(name: str) -> str:
    return f"`{BQ_DATASET}.{name}`"


def fetch_latest_macro_row(client) -> dict:
    query = f"""
        SELECT Year_Jalali, USD_Free_Market, TEDPIX_Index,
               USD_Free_Market_Lag_1, USD_Free_Market_Lag_3,
               USD_Free_Market_Lag_6, TEDPIX_Index_Lag_3
        FROM {_tbl('macro_monthly_database')}
        ORDER BY Year_Jalali DESC, Month_Jalali DESC
        LIMIT 1
    """
    rows = list(client.query(query).result())
    if not rows:
        raise ValueError("macro_monthly_database returned no rows.")
    r = rows[0]
    return {k: r[k] for k in [
        "Year_Jalali", "USD_Free_Market", "TEDPIX_Index",
        "USD_Free_Market_Lag_1", "USD_Free_Market_Lag_3",
        "USD_Free_Market_Lag_6", "TEDPIX_Index_Lag_3",
    ]}


def fetch_nearest_neighborhood(client, lat: float, lon: float) -> dict:
    query = f"""
        SELECT neighborhood_slug, neighborhood_name,
               ST_DISTANCE(
                   ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                   ST_GEOGPOINT({lon}, {lat})
               ) AS dist_m
        FROM {_tbl('ref_neighborhoods')}
        ORDER BY dist_m ASC
        LIMIT 1
    """
    rows = list(client.query(query).result())
    if not rows:
        return {"neighborhood_slug": "UNKNOWN", "neighborhood_name": "Unknown"}
    return {
        "neighborhood_slug": rows[0]["neighborhood_slug"],
        "neighborhood_name": rows[0]["neighborhood_name"],
    }


def fetch_region_id(client, neighborhood_slug: str) -> int:
    safe = neighborhood_slug.replace("'", "''")
    query = f"""
        SELECT region_id
        FROM {_tbl('ref_neighborhood_districts_static')}
        WHERE neighborhood_slug = '{safe}'
        LIMIT 1
    """
    rows = list(client.query(query).result())
    return int(rows[0]["region_id"]) if rows else 10


def fetch_spatial_features(client, lat: float, lon: float) -> dict:
    # Strip Z/M/ZM coordinate dimensions from WKT geometry — BigQuery ST_GeogFromText
    # does not support Z or M extensions (e.g. "LINESTRING (x y z)").
    # This is the exact approach used in the training notebook (Cell 13).
    strip_z = (
        "REGEXP_REPLACE("
        "REPLACE(REPLACE(geometry_wkt, ' Z', ''), ' ZM', ''), "
        r"r'([0-9eE.\-]+\s+[0-9eE.\-]+)\s+[0-9eE.\-]+(?:\s+[0-9eE.\-]+)?', "
        r"r'\1')"
    )

    query = f"""
        WITH user_point AS (SELECT ST_GEOGPOINT({lon}, {lat}) AS pt),

        -- ref_metro_stations: latitude/longitude are FLOAT — use ST_DWITHIN(10km) then MIN
        metro_calc AS (
            SELECT MIN(ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            )) AS dist
            FROM `{BQ_DATASET}.ref_metro_stations`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 10000
            )
        ),

        -- ref_highways: geometry_wkt has Z/M dimensions — strip them before ST_GeogFromText
        hwy_geom AS (
            SELECT ST_GEOGFROMTEXT({strip_z}) AS geom
            FROM `{BQ_DATASET}.ref_highways`
        ),
        hwy_calc AS (
            SELECT MIN(ST_DISTANCE(h.geom, (SELECT pt FROM user_point))) AS dist
            FROM hwy_geom h
            WHERE ST_DWITHIN(h.geom, (SELECT pt FROM user_point), 5000)
        ),

        -- ref_commercial_points: latitude/longitude are FLOAT — count within 500m
        comm_calc AS (
            SELECT COUNT(*) AS cnt
            FROM `{BQ_DATASET}.ref_commercial_points`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 500
            )
        ),

        -- ref_urban_decay: geometry_wkt has Z/M — strip, then intersect.
        -- decay_class derived from decay_zone_name (exact notebook CASE logic).
        decay_geom AS (
            SELECT
                ST_GEOGFROMTEXT({strip_z}) AS geom,
                CASE
                    WHEN decay_zone_name = 'فرسوده' THEN 4
                    WHEN decay_zone_name LIKE '%-%' THEN 3
                    WHEN decay_zone_name IN ('ریزدانگی', 'ناپایداری', 'نفوذناپذیری') THEN 2
                    WHEN decay_zone_name = 'سایر' THEN 1
                    ELSE 0
                END AS decay_class
            FROM `{BQ_DATASET}.ref_urban_decay`
        ),
        decay_calc AS (
            SELECT MAX(d.decay_class) AS decay_class
            FROM decay_geom d
            WHERE ST_INTERSECTS(d.geom, (SELECT pt FROM user_point))
        ),

        -- ref_air_quality: latitude/longitude are FLOAT — nearest within 20km
        aqi_calc AS (
            SELECT long_term_aqi AS aqi
            FROM `{BQ_DATASET}.ref_air_quality`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 20000
            )
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC
            LIMIT 1
        ),

        -- ref_traffic_zones: geometry_wkt has Z/M — strip, then ST_INTERSECTS. MAX of traffic_zone_status.
        traffic_geom AS (
            SELECT
                ST_GEOGFROMTEXT({strip_z}) AS geom,
                CAST(traffic_zone_status AS INT64) AS traffic_score
            FROM `{BQ_DATASET}.ref_traffic_zones`
        ),
        traffic_calc AS (
            SELECT MAX(t.traffic_score) AS traffic_score
            FROM traffic_geom t
            WHERE ST_INTERSECTS(t.geom, (SELECT pt FROM user_point))
        ),

        -- ref_seismic_risk: latitude/longitude are FLOAT — AVG within 500m radius
        seismic_calc AS (
            SELECT ROUND(AVG(CAST(seismic_risk_level AS INT64))) AS seismic_risk
            FROM `{BQ_DATASET}.ref_seismic_risk`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 500
            )
        )

        SELECT
            COALESCE((SELECT dist FROM metro_calc),          10000.0) AS dist_to_metro,
            COALESCE((SELECT dist FROM hwy_calc),             5000.0) AS dist_to_highway,
            ST_DISTANCE(ST_GEOGPOINT({TEHRAN_CBD_LON},{TEHRAN_CBD_LAT}),
                        ST_GEOGPOINT({lon},{lat}))                    AS dist_to_cbd,
            COALESCE((SELECT cnt FROM comm_calc),                  0) AS commercial_density,
            COALESCE((SELECT decay_class FROM decay_calc),         0) AS urban_decay_class,
            COALESCE((SELECT aqi FROM aqi_calc),                 0.0) AS air_quality_aqi,
            COALESCE((SELECT traffic_score FROM traffic_calc),     0) AS traffic_zone_status,
            COALESCE((SELECT seismic_risk FROM seismic_calc),      1) AS seismic_risk_level
    """
    rows = list(client.query(query).result())
    if not rows:
        return {
            "dist_to_metro": 10000.0, "dist_to_highway": 5000.0,
            "dist_to_cbd": 0.0, "commercial_density": 0,
            "urban_decay_class": 0, "air_quality_aqi": 0.0,
            "traffic_zone_status": 0, "seismic_risk_level": 1,
        }
    r = rows[0]
    return {
        "dist_to_metro":       float(r["dist_to_metro"]      or 10000.0),
        "dist_to_highway":     float(r["dist_to_highway"]    or 5000.0),
        "dist_to_cbd":         float(r["dist_to_cbd"]        or 0.0),
        "commercial_density":  int(r["commercial_density"]   or 0),
        "urban_decay_class":   int(r["urban_decay_class"]    or 0),
        "air_quality_aqi":     float(r["air_quality_aqi"]    or 0.0),
        "traffic_zone_status": int(r["traffic_zone_status"]  or 0),
        "seismic_risk_level":  int(r["seismic_risk_level"]   or 1),
    }

def engineer_micro_features(req: PredictRequest, spatial: dict,
                             region_id: int, neighborhood_encoded: float) -> list:
    floor_elevator_penalty   = req.floor_num * (1 - int(req.has_elevator))
    value_retention_bonus    = int(req.is_rebuilt)
    bonus_tod_livability     = max(0.0, 1.0 - spatial["dist_to_metro"] / 1500.0)
    penalty_traffic_nuisance = float(spatial["traffic_zone_status"])
    suburban_flag            = 1.0 if spatial["dist_to_cbd"] > 12000 else 0.0
    suburban_metro_dependency= (spatial["dist_to_metro"] / 1000.0) * suburban_flag
    redevelopment_premium    = int(req.is_rebuilt) * spatial["urban_decay_class"]
    highway_sweetspot        = 1 if 200 <= spatial["dist_to_highway"] <= 900 else 0
    land_size                = req.area if req.is_villa else 0.0

    return [
        int(req.has_elevator), int(req.has_parking), int(req.has_warehouse),
        int(req.is_rebuilt), 0, 0,  # is_centroid_imputed=0, is_price_converted=0
        int(req.is_villa), land_size, req.area, req.rooms_count,
        req.building_age, req.lat, req.lon, 0.0,  # location_radius=0
        spatial["commercial_density"], spatial["dist_to_metro"],
        spatial["dist_to_cbd"], spatial["dist_to_highway"],
        spatial["seismic_risk_level"], spatial["air_quality_aqi"],
        spatial["traffic_zone_status"], spatial["urban_decay_class"],
        floor_elevator_penalty, value_retention_bonus, bonus_tod_livability,
        penalty_traffic_nuisance, suburban_metro_dependency, redevelopment_premium,
        highway_sweetspot, region_id, req.floor_num, req.total_floors,
        req.unit_per_floor, neighborhood_encoded,
    ]


def build_macro_features(year_jalali, usd, tedpix,
                          lag1, lag3, lag6, tedpix_lag3, region_id) -> list:
    ohe = [1 if i == region_id else 0 for i in range(1, 23)]
    return [year_jalali, usd, tedpix, lag1, lag3, lag6, tedpix_lag3] + ohe


# ─────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Tehran Real Estate Price Predictor API",
        "version": "2.0.0",
        "status": "running",
        "models_loaded": "macro" in _cache,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "models_loaded": "macro" in _cache,
        "auth_mode": "Application Default Credentials (Cloud Run ADC)",
    }


@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(req: PredictRequest):
    # ── Check models are loaded ──
    if "macro" not in _cache:
        raise HTTPException(
            status_code=503,
            detail="Models not loaded. Place model files in backend/models/ and restart.",
        )

    try:
        # A: Live rates
        print(f"[predict] lat={req.lat}, lon={req.lon}, area={req.area}")
        print("[A] Scraping live rates...")
        live = scrape_live_rates()

        # B: BigQuery
        print("[B] Connecting to BigQuery...")
        bq = get_bq_client()

        print("[B1] Fetching macro row...")
        macro_row = fetch_latest_macro_row(bq)
        live_usd    = live.get("usd")    or float(macro_row["USD_Free_Market"])
        live_tedpix = live.get("tedpix") or float(macro_row["TEDPIX_Index"])

        print("[B2] Nearest neighborhood...")
        nb = fetch_nearest_neighborhood(bq, req.lat, req.lon)
        slug = nb["neighborhood_slug"]

        print("[B3] Region ID...")
        region_id = fetch_region_id(bq, slug)

        print("[B4] Spatial features...")
        spatial = fetch_spatial_features(bq, req.lat, req.lon)

        # C: Encoding
        enc_dict = _cache["encoding"]
        global_mean = float(enc_dict.get("GLOBAL_MEAN", 1.0))
        nb_encoded  = float(enc_dict.get(slug, global_mean))
        print(f"[C] slug={slug!r} encoded={nb_encoded:.4f} region={region_id}")

        # D: Inference
        print("[D] Running inference...")
        macro_feat = build_macro_features(
            int(macro_row["Year_Jalali"]), live_usd, live_tedpix,
            float(macro_row["USD_Free_Market_Lag_1"]),
            float(macro_row["USD_Free_Market_Lag_3"]),
            float(macro_row["USD_Free_Market_Lag_6"]),
            float(macro_row["TEDPIX_Index_Lag_3"]),
            region_id,
        )
        macro_dm = xgb.DMatrix(
            np.array([macro_feat], dtype=float),
            feature_names=MACRO_COLUMNS,
        )
        base_price = float(_cache["macro"].predict(macro_dm)[0])

        micro_feat = engineer_micro_features(req, spatial, region_id, nb_encoded)
        micro_dm = xgb.DMatrix(
            np.array([micro_feat], dtype=float),
            feature_names=MICRO_COLUMNS,
        )
        quality_ratio = float(_cache["micro"].predict(micro_dm)[0])

        final_per_sqm = base_price * quality_ratio
        final_total   = final_per_sqm * req.area

        print(f"[D] {base_price:,.0f} × {quality_ratio:.4f} × {req.area} = {final_total:,.0f}")

        return PredictResponse(
            base_price_per_sqm  = round(base_price, 2),
            quality_ratio       = round(quality_ratio, 6),
            final_price_per_sqm = round(final_per_sqm, 2),
            final_total_price   = round(final_total, 2),
            usd_rate            = round(live_usd, 2),
            tedpix              = round(live_tedpix, 2),
            neighborhood        = slug,
            neighborhood_name   = nb.get("neighborhood_name", slug),
            region_id           = region_id,
            year_jalali         = int(macro_row["Year_Jalali"]),
            spatial             = SpatialFeatures(
                dist_to_metro_m    = round(spatial["dist_to_metro"], 1),
                dist_to_cbd_m      = round(spatial["dist_to_cbd"], 1),
                dist_to_highway_m  = round(spatial["dist_to_highway"], 1),
                commercial_density = spatial["commercial_density"],
                seismic_risk_level = spatial["seismic_risk_level"],
                air_quality_aqi    = spatial["air_quality_aqi"],
                traffic_zone_status= spatial["traffic_zone_status"],
                urban_decay_class  = spatial["urban_decay_class"],
            ),
        )

    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"[ERROR]\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
