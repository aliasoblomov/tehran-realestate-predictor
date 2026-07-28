"""
Tehran Real Estate Price Prediction — Vercel Python Serverless Function
/api/predict.py

Dependencies (slim build — no google-cloud-bigquery, no pandas):
  - xgboost, numpy         → ML inference
  - google-auth            → BigQuery REST API authentication
  - requests               → HTTP calls (scraping + BigQuery REST)
  - beautifulsoup4         → tgju.org scraping

Pipeline:
  A. Live-scrape USD/IRR & TEDPIX from tgju.org
  B. BigQuery REST API:
       B1. Latest macro_monthly_database row → lag features
       B2. Nearest-centroid match → neighborhood_slug
       B3. ref_neighborhood_districts_static join → region_id
       B4. Spatial queries → metro/highway/CBD distance, density, etc.
  C. Load XGBoost models + neighborhood encoding
  D. Engineer micro features, build DMatrix with numpy, run inference
  E. Return JSON response
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import traceback

# ─────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────
TEHRAN_CBD_LON = 51.4183
TEHRAN_CBD_LAT = 35.6961

BQ_DATASET = "siavak-temp-aliz.divar_ml_data_prepration"

# Fallback defaults matching training-time imputation
FALLBACK_DIST_MAX = 10000.0
FALLBACK_COMM_DENSITY = 0
FALLBACK_URBAN_DECAY = 2
FALLBACK_AIR_QUALITY = 100
FALLBACK_TRAFFIC_ZONE = 1
FALLBACK_SEISMIC_RISK = 3


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
            ("usd", "https://www.tgju.org/profile/price_dollar_rl"),
            ("tedpix", "https://www.tgju.org/profile/tedpix"),
        ]:
            try:
                resp = requests.get(url, headers=headers, timeout=8)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    tag = soup.find("span", {"data-col": "info_price_rial"})
                    if tag and tag.get("data-value"):
                        raw = tag["data-value"].replace(",", "").strip()
                        result[key] = float(raw)
                    else:
                        for t in soup.select(
                            ".market-profile-primary-price strong, .info-price"
                        ):
                            text = t.get_text(strip=True).replace(",", "")
                            try:
                                val = float(
                                    "".join(
                                        c for c in text if c.isdigit() or c == "."
                                    )
                                )
                                if val > 100_000:
                                    result[key] = val
                                    break
                            except ValueError:
                                continue
            except Exception as e:
                print(f"[SCRAPE] {key} failed: {e}")

    except ImportError as e:
        print(f"[SCRAPE] Import error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# SECTION B: BigQuery REST client (no google-cloud-bigquery SDK)
# ─────────────────────────────────────────────────────────
class BigQueryRestClient:
    """
    Minimal BigQuery client using the REST API directly.
    Eliminates the google-cloud-bigquery SDK (~300MB of dependencies).
    """

    BQ_SCOPE = "https://www.googleapis.com/auth/bigquery.readonly"
    QUERY_URL = "https://bigquery.googleapis.com/bigquery/v2/projects/{project}/queries"

    def __init__(self, credentials_json: dict):
        from google.oauth2 import service_account
        self.project_id = credentials_json.get("project_id", "siavak-temp-aliz")
        self.credentials = service_account.Credentials.from_service_account_info(
            credentials_json, scopes=[self.BQ_SCOPE]
        )

    def _get_token(self) -> str:
        import requests as req_lib
        from google.auth.transport.requests import Request
        if not self.credentials.valid or self.credentials.expired:
            self.credentials.refresh(Request())
        return self.credentials.token

    def query(self, sql: str, timeout_ms: int = 25000) -> list:
        """
        Run a synchronous BigQuery query and return list of row dicts.
        Uses the fast synchronous /queries endpoint (returns inline results).
        """
        import requests
        token = self._get_token()
        url = self.QUERY_URL.format(project=self.project_id)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "query": sql,
            "useLegacySql": False,
            "timeoutMs": timeout_ms,
            "location": "US",
            "maxResults": 10,
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=28)
        resp.raise_for_status()
        data = resp.json()

        if not data.get("jobComplete"):
            raise TimeoutError("BigQuery query timed out (jobComplete=false)")

        schema_fields = data.get("schema", {}).get("fields", [])
        rows_raw = data.get("rows", [])

        result = []
        for row in rows_raw:
            record = {}
            for i, field in enumerate(schema_fields):
                raw_val = row["f"][i]["v"]
                name = field["name"]
                ftype = field.get("type", "STRING")
                if raw_val is None:
                    record[name] = None
                elif ftype in ("FLOAT", "FLOAT64", "NUMERIC", "BIGNUMERIC"):
                    try:
                        record[name] = float(raw_val)
                    except (TypeError, ValueError):
                        record[name] = None
                elif ftype in ("INTEGER", "INT64"):
                    try:
                        record[name] = int(float(raw_val))
                    except (TypeError, ValueError):
                        record[name] = None
                else:
                    record[name] = raw_val
            result.append(record)

        return result


def get_bq_client() -> BigQueryRestClient:
    creds_raw = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_raw:
        raise EnvironmentError("GOOGLE_CREDENTIALS_JSON env var is not set.")
    creds_dict = json.loads(creds_raw)
    return BigQueryRestClient(creds_dict)


# ─────────────────────────────────────────────────────────
# SECTION B: BigQuery SQL helpers
# ─────────────────────────────────────────────────────────
def _tbl(name: str) -> str:
    return f"`{BQ_DATASET}.{name}`"


def fetch_latest_macro_row(client: BigQueryRestClient) -> dict:
    sql = f"""
        SELECT
            Year_Jalali, USD_Free_Market, TEDPIX_Index,
            USD_Free_Market_Lag_1, USD_Free_Market_Lag_3,
            USD_Free_Market_Lag_6, TEDPIX_Index_Lag_3
        FROM {_tbl('macro_monthly_database')}
        ORDER BY Year_Jalali DESC, Month_Jalali DESC
        LIMIT 1
    """
    rows = client.query(sql)
    if not rows:
        raise ValueError("macro_monthly_database returned no rows.")
    return rows[0]


def fetch_nearest_neighborhood(
    client: BigQueryRestClient, lat: float, lon: float
) -> dict:
    sql = f"""
        SELECT
            neighborhood_slug,
            neighborhood_name,
            ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                ST_GEOGPOINT({lon}, {lat})
            ) AS dist_m
        FROM {_tbl('ref_neighborhoods')}
        ORDER BY dist_m ASC
        LIMIT 1
    """
    rows = client.query(sql)
    if not rows:
        return {"neighborhood_slug": "UNKNOWN", "neighborhood_name": "Unknown"}
    return {
        "neighborhood_slug": rows[0].get("neighborhood_slug", "UNKNOWN"),
        "neighborhood_name": rows[0].get("neighborhood_name", "Unknown"),
    }


def fetch_region_id(client: BigQueryRestClient, neighborhood_slug: str) -> int:
    # Sanitize slug to prevent injection
    safe_slug = neighborhood_slug.replace("'", "''")
    sql = f"""
        SELECT region_id
        FROM {_tbl('ref_neighborhood_districts_static')}
        WHERE neighborhood_slug = '{safe_slug}'
        LIMIT 1
    """
    rows = client.query(sql)
    if not rows or rows[0].get("region_id") is None:
        return 10  # central Tehran safe default
    return int(rows[0]["region_id"])


def fetch_spatial_features(
    client: BigQueryRestClient, lat: float, lon: float
) -> dict:
    sql = f"""
        WITH user_point AS (
            SELECT ST_GEOGPOINT({lon}, {lat}) AS pt
        ),
        metro_dist AS (
            SELECT MIN(ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            )) AS dist
            FROM {_tbl('ref_metro_stations')}
        ),
        highway_dist AS (
            SELECT MIN(ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            )) AS dist
            FROM {_tbl('ref_highways')}
        ),
        comm_density AS (
            SELECT COUNT(*) AS cnt
            FROM {_tbl('ref_commercial_points')}
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 500
            )
        ),
        urban_decay AS (
            SELECT decay_class
            FROM {_tbl('ref_urban_decay')}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC LIMIT 1
        ),
        air_quality AS (
            SELECT aqi
            FROM {_tbl('ref_air_quality')}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC LIMIT 1
        ),
        traffic AS (
            SELECT zone_status
            FROM {_tbl('ref_traffic_zones')}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC LIMIT 1
        ),
        seismic AS (
            SELECT risk_level
            FROM {_tbl('ref_seismic_risk')}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC LIMIT 1
        )
        SELECT
            COALESCE((SELECT dist FROM metro_dist),   {FALLBACK_DIST_MAX})    AS dist_to_metro,
            COALESCE((SELECT dist FROM highway_dist), {FALLBACK_DIST_MAX})    AS dist_to_highway,
            ST_DISTANCE(
                ST_GEOGPOINT({TEHRAN_CBD_LON}, {TEHRAN_CBD_LAT}),
                ST_GEOGPOINT({lon}, {lat})
            )                                                                  AS dist_to_cbd,
            COALESCE((SELECT cnt FROM comm_density),          {FALLBACK_COMM_DENSITY})  AS commercial_density,
            COALESCE((SELECT decay_class FROM urban_decay),   {FALLBACK_URBAN_DECAY})   AS urban_decay_class,
            COALESCE((SELECT aqi FROM air_quality),           {FALLBACK_AIR_QUALITY})   AS air_quality_aqi,
            COALESCE((SELECT zone_status FROM traffic),       {FALLBACK_TRAFFIC_ZONE})  AS traffic_zone_status,
            COALESCE((SELECT risk_level FROM seismic),        {FALLBACK_SEISMIC_RISK})  AS seismic_risk_level
    """
    rows = client.query(sql)
    if not rows:
        return {
            "dist_to_metro": FALLBACK_DIST_MAX,
            "dist_to_highway": FALLBACK_DIST_MAX,
            "dist_to_cbd": 0.0,
            "commercial_density": FALLBACK_COMM_DENSITY,
            "urban_decay_class": FALLBACK_URBAN_DECAY,
            "air_quality_aqi": float(FALLBACK_AIR_QUALITY),
            "traffic_zone_status": FALLBACK_TRAFFIC_ZONE,
            "seismic_risk_level": FALLBACK_SEISMIC_RISK,
        }
    r = rows[0]
    return {
        "dist_to_metro":      float(r.get("dist_to_metro")      or FALLBACK_DIST_MAX),
        "dist_to_highway":    float(r.get("dist_to_highway")    or FALLBACK_DIST_MAX),
        "dist_to_cbd":        float(r.get("dist_to_cbd")        or 0.0),
        "commercial_density": int(r.get("commercial_density")   or FALLBACK_COMM_DENSITY),
        "urban_decay_class":  int(r.get("urban_decay_class")    or FALLBACK_URBAN_DECAY),
        "air_quality_aqi":    float(r.get("air_quality_aqi")    or FALLBACK_AIR_QUALITY),
        "traffic_zone_status":int(r.get("traffic_zone_status")  or FALLBACK_TRAFFIC_ZONE),
        "seismic_risk_level": int(r.get("seismic_risk_level")   or FALLBACK_SEISMIC_RISK),
    }


# ─────────────────────────────────────────────────────────
# SECTION C: Model loading
# ─────────────────────────────────────────────────────────
def load_models_and_encoding():
    import xgboost as xgb

    models_dir = os.path.join(os.path.dirname(__file__), "models")
    macro_path    = os.path.join(models_dir, "macro_clean_model.json")
    micro_path    = os.path.join(models_dir, "micro_model.json")
    encoding_path = os.path.join(models_dir, "neighborhood_encoding.json")

    for path in [macro_path, micro_path, encoding_path]:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Model file not found: {path}\n"
                "Place macro_clean_model.json, micro_model.json, and "
                "neighborhood_encoding.json in /api/models/"
            )

    macro_booster = xgb.Booster()
    macro_booster.load_model(macro_path)

    micro_booster = xgb.Booster()
    micro_booster.load_model(micro_path)

    with open(encoding_path, "r", encoding="utf-8") as f:
        encoding_dict = json.load(f)

    return macro_booster, micro_booster, encoding_dict


# ─────────────────────────────────────────────────────────
# SECTION D: Feature engineering
# ─────────────────────────────────────────────────────────
def engineer_micro_features(
    *,
    has_elevator, has_parking, has_warehouse, is_rebuilt, is_villa,
    building_size, rooms_count, building_age, floor_num, total_floors,
    unit_per_floor, lat, lon,
    commercial_density, dist_to_metro, dist_to_cbd, dist_to_highway,
    seismic_risk_level, air_quality_aqi, traffic_zone_status, urban_decay_class,
    region_id, neighborhood_encoded,
) -> list:
    """
    Return micro feature values in the EXACT column order used during training.
    Order:
      has_elevator, has_parking, has_warehouse, is_rebuilt, is_centroid_imputed,
      is_price_converted, is_villa, land_size, building_size, rooms_count,
      building_age, location_latitude, location_longitude, location_radius,
      commercial_density, dist_to_metro, dist_to_cbd, dist_to_highway,
      seismic_risk_level, air_quality_aqi, traffic_zone_status, urban_decay_class,
      floor_elevator_penalty, value_retention_bonus, bonus_tod_livability,
      penalty_traffic_nuisance, suburban_metro_dependency, redevelopment_premium,
      highway_sweetspot, region_id, floor_num, total_floors_num,
      unit_per_floor_num, neighborhood_encoded
    """
    # Engineered features
    floor_elevator_penalty  = floor_num * (1 - int(has_elevator))
    value_retention_bonus   = int(is_rebuilt)
    bonus_tod_livability    = max(0.0, 1.0 - dist_to_metro / 1500.0)
    penalty_traffic_nuisance = float(traffic_zone_status)
    suburban_flag           = 1.0 if dist_to_cbd > 12000 else 0.0
    suburban_metro_dependency = (dist_to_metro / 1000.0) * suburban_flag
    redevelopment_premium   = int(is_rebuilt) * urban_decay_class
    highway_sweetspot       = 1 if 200 <= dist_to_highway <= 900 else 0
    land_size               = building_size if is_villa else 0.0
    location_radius         = 0.0
    is_centroid_imputed     = 0
    is_price_converted      = 0

    return [
        int(has_elevator), int(has_parking), int(has_warehouse),
        int(is_rebuilt), is_centroid_imputed, is_price_converted,
        int(is_villa), land_size, building_size, rooms_count,
        building_age, lat, lon, location_radius,
        commercial_density, dist_to_metro, dist_to_cbd, dist_to_highway,
        seismic_risk_level, air_quality_aqi, traffic_zone_status, urban_decay_class,
        floor_elevator_penalty, value_retention_bonus, bonus_tod_livability,
        penalty_traffic_nuisance, suburban_metro_dependency, redevelopment_premium,
        highway_sweetspot, region_id, floor_num, total_floors, unit_per_floor,
        neighborhood_encoded,
    ]


MICRO_COLUMNS = [
    "has_elevator", "has_parking", "has_warehouse",
    "is_rebuilt", "is_centroid_imputed", "is_price_converted",
    "is_villa", "land_size", "building_size", "rooms_count",
    "building_age", "location_latitude", "location_longitude",
    "location_radius", "commercial_density", "dist_to_metro",
    "dist_to_cbd", "dist_to_highway", "seismic_risk_level",
    "air_quality_aqi", "traffic_zone_status", "urban_decay_class",
    "floor_elevator_penalty", "value_retention_bonus",
    "bonus_tod_livability", "penalty_traffic_nuisance",
    "suburban_metro_dependency", "redevelopment_premium",
    "highway_sweetspot", "region_id", "floor_num",
    "total_floors_num", "unit_per_floor_num", "neighborhood_encoded",
]

MACRO_COLUMNS = (
    ["Year_Jalali", "USD_Free_Market", "TEDPIX_Index",
     "USD_Free_Market_Lag_1", "USD_Free_Market_Lag_3",
     "USD_Free_Market_Lag_6", "TEDPIX_Index_Lag_3"]
    + [f"region_id_{i}" for i in range(1, 23)]
)


def build_macro_features(
    *, year_jalali, usd_live, tedpix_live,
    usd_lag_1, usd_lag_3, usd_lag_6, tedpix_lag_3, region_id,
) -> list:
    region_ohe = [1 if i == region_id else 0 for i in range(1, 23)]
    return [
        year_jalali, usd_live, tedpix_live,
        usd_lag_1, usd_lag_3, usd_lag_6, tedpix_lag_3,
    ] + region_ohe


# ─────────────────────────────────────────────────────────
# SECTION E: Request handler (Vercel serverless)
# ─────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self._handle()

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle(self):
        # ── Parse body ──
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            lat            = float(body["lat"])
            lon            = float(body["lon"])
            area           = float(body["area"])
            building_age   = int(body.get("building_age", 10))
            total_floors   = int(body.get("total_floors", 6))
            floor_num      = int(body.get("floor_num", 2))
            unit_per_floor = int(body.get("unit_per_floor", 2))
            rooms_count    = int(body.get("rooms_count", 2))
            has_elevator   = bool(body.get("has_elevator", True))
            has_parking    = bool(body.get("has_parking", True))
            has_warehouse  = bool(body.get("has_warehouse", False))
            is_rebuilt     = bool(body.get("is_rebuilt", False))
            is_villa       = bool(body.get("is_villa", False))
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            self._json(400, {"error": f"Invalid payload: {e}"}); return

        try:
            import numpy as np
            import xgboost as xgb

            # ── A: Scrape live rates ──
            print("[A] Scraping live rates...")
            live = scrape_live_rates()
            live_usd    = live.get("usd")
            live_tedpix = live.get("tedpix")

            # ── B: BigQuery ──
            print("[B] Connecting to BigQuery REST API...")
            client = get_bq_client()

            print("[B1] Fetching macro row...")
            macro_row = fetch_latest_macro_row(client)
            if not live_usd or live_usd <= 0:
                live_usd = float(macro_row["USD_Free_Market"])
            if not live_tedpix or live_tedpix <= 0:
                live_tedpix = float(macro_row["TEDPIX_Index"])

            year_jalali = int(macro_row["Year_Jalali"])
            usd_lag_1   = float(macro_row["USD_Free_Market_Lag_1"])
            usd_lag_3   = float(macro_row["USD_Free_Market_Lag_3"])
            usd_lag_6   = float(macro_row["USD_Free_Market_Lag_6"])
            tedpix_lag_3= float(macro_row["TEDPIX_Index_Lag_3"])

            print("[B2] Finding nearest neighborhood...")
            nb = fetch_nearest_neighborhood(client, lat, lon)
            neighborhood_slug = nb["neighborhood_slug"]
            neighborhood_name = nb.get("neighborhood_name", neighborhood_slug)

            print("[B3] Fetching region_id...")
            region_id = fetch_region_id(client, neighborhood_slug)

            print("[B4] Fetching spatial features...")
            spatial = fetch_spatial_features(client, lat, lon)

            # ── C: Load models ──
            print("[C] Loading models...")
            macro_booster, micro_booster, enc_dict = load_models_and_encoding()
            global_mean = float(enc_dict.get("GLOBAL_MEAN", 1.0))
            neighborhood_encoded = float(enc_dict.get(neighborhood_slug, global_mean))
            print(f"[C] slug={neighborhood_slug!r} encoded={neighborhood_encoded:.4f}")

            # ── D: Inference ──
            print("[D] Running inference...")

            # Macro
            macro_feat = build_macro_features(
                year_jalali=year_jalali, usd_live=live_usd, tedpix_live=live_tedpix,
                usd_lag_1=usd_lag_1, usd_lag_3=usd_lag_3, usd_lag_6=usd_lag_6,
                tedpix_lag_3=tedpix_lag_3, region_id=region_id,
            )
            macro_arr = np.array([macro_feat], dtype=float)
            macro_dmatrix = xgb.DMatrix(macro_arr, feature_names=MACRO_COLUMNS)
            base_price_per_sqm = float(macro_booster.predict(macro_dmatrix)[0])

            # Micro
            micro_feat = engineer_micro_features(
                has_elevator=has_elevator, has_parking=has_parking,
                has_warehouse=has_warehouse, is_rebuilt=is_rebuilt, is_villa=is_villa,
                building_size=area, rooms_count=rooms_count, building_age=building_age,
                floor_num=floor_num, total_floors=total_floors,
                unit_per_floor=unit_per_floor, lat=lat, lon=lon,
                commercial_density=spatial["commercial_density"],
                dist_to_metro=spatial["dist_to_metro"],
                dist_to_cbd=spatial["dist_to_cbd"],
                dist_to_highway=spatial["dist_to_highway"],
                seismic_risk_level=spatial["seismic_risk_level"],
                air_quality_aqi=spatial["air_quality_aqi"],
                traffic_zone_status=spatial["traffic_zone_status"],
                urban_decay_class=spatial["urban_decay_class"],
                region_id=region_id,
                neighborhood_encoded=neighborhood_encoded,
            )
            micro_arr = np.array([micro_feat], dtype=float)
            micro_dmatrix = xgb.DMatrix(micro_arr, feature_names=MICRO_COLUMNS)
            quality_ratio = float(micro_booster.predict(micro_dmatrix)[0])

            # Final price
            final_price_per_sqm = base_price_per_sqm * quality_ratio
            final_total_price   = final_price_per_sqm * area

            print(
                f"[D] base={base_price_per_sqm:,.0f} × ratio={quality_ratio:.4f} "
                f"× area={area} = {final_total_price:,.0f}"
            )

            self._json(200, {
                "base_price_per_sqm":  round(base_price_per_sqm, 2),
                "quality_ratio":       round(quality_ratio, 6),
                "final_price_per_sqm": round(final_price_per_sqm, 2),
                "final_total_price":   round(final_total_price, 2),
                "usd_rate":            round(live_usd, 2),
                "tedpix":              round(live_tedpix, 2),
                "neighborhood":        neighborhood_slug,
                "neighborhood_name":   neighborhood_name,
                "region_id":           region_id,
                "year_jalali":         year_jalali,
                "spatial": {
                    "dist_to_metro_m":    round(spatial["dist_to_metro"], 1),
                    "dist_to_cbd_m":      round(spatial["dist_to_cbd"], 1),
                    "dist_to_highway_m":  round(spatial["dist_to_highway"], 1),
                    "commercial_density": spatial["commercial_density"],
                    "seismic_risk_level": spatial["seismic_risk_level"],
                    "air_quality_aqi":    spatial["air_quality_aqi"],
                    "traffic_zone_status":spatial["traffic_zone_status"],
                    "urban_decay_class":  spatial["urban_decay_class"],
                },
            })

        except FileNotFoundError as e:
            print(f"[ERROR] {e}")
            self._json(500, {"error": str(e)})
        except EnvironmentError as e:
            print(f"[ERROR] {e}")
            self._json(500, {"error": str(e)})
        except Exception as e:
            print(f"[ERROR]\n{traceback.format_exc()}")
            self._json(500, {"error": f"Prediction failed: {e}"})
