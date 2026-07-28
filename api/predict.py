"""
Tehran Real Estate Price Prediction — Vercel Python Serverless Function
/api/predict.py

Pipeline:
  A. Live-scrape USD/IRR & TEDPIX from tgju.org
  B. BigQuery:
       B1. Latest row of macro_monthly_database → lag features + current period values
       B2. Nearest-centroid match → neighborhood_slug
       B3. neighborhood_districts_static join → region_id
       B4. Spatial queries → dist_to_metro, commercial_density, etc.
  C. Load XGBoost models + neighborhood encoding
  D. Engineer micro features, build DMatrix, run inference
  E. Return JSON response
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import math
import traceback

# ─────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────
TEHRAN_CBD_LON = 51.4183
TEHRAN_CBD_LAT = 35.6961

BQ_DATASET = "siavak-temp-aliz.divar_ml_data_prepration"
BQ_TABLE_MACRO = f"`{BQ_DATASET}.macro_monthly_database`"
BQ_TABLE_NEIGHBORHOODS = f"`{BQ_DATASET}.ref_neighborhoods`"
BQ_TABLE_NB_DISTRICTS = f"`{BQ_DATASET}.ref_neighborhood_districts_static`"
BQ_TABLE_METRO = f"`{BQ_DATASET}.ref_metro_stations`"
BQ_TABLE_HIGHWAYS = f"`{BQ_DATASET}.ref_highways`"
BQ_TABLE_COMMERCIAL = f"`{BQ_DATASET}.ref_commercial_points`"
BQ_TABLE_URBAN_DECAY = f"`{BQ_DATASET}.ref_urban_decay`"
BQ_TABLE_AIR_QUALITY = f"`{BQ_DATASET}.ref_air_quality`"
BQ_TABLE_TRAFFIC = f"`{BQ_DATASET}.ref_traffic_zones`"
BQ_TABLE_SEISMIC = f"`{BQ_DATASET}.ref_seismic_risk`"

# Fallback defaults matching training-time imputation
FALLBACK_DIST_MAX = 10000.0       # meters — max distance cap
FALLBACK_COMM_DENSITY = 0         # zero commercial points nearby
FALLBACK_URBAN_DECAY = 2          # medium class
FALLBACK_AIR_QUALITY = 100        # medium AQI
FALLBACK_TRAFFIC_ZONE = 1         # medium status
FALLBACK_SEISMIC_RISK = 3         # medium level

# Fallback macro values (used only if BQ query also fails)
FALLBACK_USD = 620000
FALLBACK_TEDPIX = 2500000
FALLBACK_USD_LAG_1 = 600000
FALLBACK_USD_LAG_3 = 560000
FALLBACK_USD_LAG_6 = 520000
FALLBACK_TEDPIX_LAG_3 = 2350000
FALLBACK_YEAR_JALALI = 1404

# ─────────────────────────────────────────────────────────
# SECTION A: Live scraping
# ─────────────────────────────────────────────────────────
def scrape_live_rates() -> dict:
    """
    Scrape live USD free-market rate and TEDPIX from tgju.org.
    Returns dict with 'usd' and 'tedpix' keys, or None values on failure.
    """
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

        # ── USD free-market rate ──
        try:
            resp = requests.get(
                "https://www.tgju.org/profile/price_dollar_rl",
                headers=headers,
                timeout=8,
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                # Primary selector: data-value attribute on the price span
                price_tag = soup.find("span", {"data-col": "info_price_rial"})
                if price_tag and price_tag.get("data-value"):
                    raw = price_tag["data-value"].replace(",", "").strip()
                    result["usd"] = float(raw)
                else:
                    # Fallback: look for the first large number in the page header area
                    for tag in soup.select(".market-profile-primary-price strong, .info-price"):
                        text = tag.get_text(strip=True).replace(",", "").replace("\u060c", "")
                        try:
                            val = float("".join(filter(lambda c: c.isdigit() or c == ".", text)))
                            if val > 100_000:  # sanity check: must be > 100,000 IRR
                                result["usd"] = val
                                break
                        except ValueError:
                            continue
        except Exception as e:
            print(f"[SCRAPE] USD scrape failed: {e}")

        # ── TEDPIX index ──
        try:
            resp = requests.get(
                "https://www.tgju.org/profile/tedpix",
                headers=headers,
                timeout=8,
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                price_tag = soup.find("span", {"data-col": "info_price_rial"})
                if price_tag and price_tag.get("data-value"):
                    raw = price_tag["data-value"].replace(",", "").strip()
                    result["tedpix"] = float(raw)
                else:
                    for tag in soup.select(".market-profile-primary-price strong, .info-price"):
                        text = tag.get_text(strip=True).replace(",", "")
                        try:
                            val = float("".join(filter(lambda c: c.isdigit() or c == ".", text)))
                            if val > 100_000:
                                result["tedpix"] = val
                                break
                        except ValueError:
                            continue
        except Exception as e:
            print(f"[SCRAPE] TEDPIX scrape failed: {e}")

    except ImportError as e:
        print(f"[SCRAPE] Import error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# SECTION B: BigQuery helpers
# ─────────────────────────────────────────────────────────
def get_bq_client():
    """
    Authenticate with BigQuery using GOOGLE_CREDENTIALS_JSON env var.
    Expects a single-line stringified JSON of a GCP service account.
    """
    import json
    import os
    from google.cloud import bigquery
    from google.oauth2 import service_account

    creds_raw = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_raw:
        raise EnvironmentError("GOOGLE_CREDENTIALS_JSON environment variable is not set.")

    creds_dict = json.loads(creds_raw)
    credentials = service_account.Credentials.from_service_account_info(
        creds_dict,
        scopes=["https://www.googleapis.com/auth/bigquery.readonly"],
    )
    project_id = creds_dict.get("project_id", "siavak-temp-aliz")
    client = bigquery.Client(credentials=credentials, project=project_id)
    return client


def fetch_latest_macro_row(client) -> dict:
    """
    Fetch the most recent row from macro_monthly_database.
    Returns all lag features + current USD/TEDPIX/Year_Jalali.
    """
    query = f"""
        SELECT
            Year_Jalali,
            USD_Free_Market,
            TEDPIX_Index,
            USD_Free_Market_Lag_1,
            USD_Free_Market_Lag_3,
            USD_Free_Market_Lag_6,
            TEDPIX_Index_Lag_3
        FROM {BQ_TABLE_MACRO}
        ORDER BY Year_Jalali DESC, Month_Jalali DESC
        LIMIT 1
    """
    rows = list(client.query(query).result())
    if not rows:
        raise ValueError("macro_monthly_database returned no rows.")
    row = rows[0]
    return {
        "Year_Jalali": row["Year_Jalali"],
        "USD_Free_Market": row["USD_Free_Market"],
        "TEDPIX_Index": row["TEDPIX_Index"],
        "USD_Free_Market_Lag_1": row["USD_Free_Market_Lag_1"],
        "USD_Free_Market_Lag_3": row["USD_Free_Market_Lag_3"],
        "USD_Free_Market_Lag_6": row["USD_Free_Market_Lag_6"],
        "TEDPIX_Index_Lag_3": row["TEDPIX_Index_Lag_3"],
    }


def fetch_nearest_neighborhood(client, lat: float, lon: float) -> dict:
    """
    Find the closest neighborhood centroid to the user's pin.
    Returns neighborhood_slug, neighborhood_name.
    """
    query = f"""
        SELECT
            neighborhood_slug,
            neighborhood_name,
            ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                ST_GEOGPOINT({lon}, {lat})
            ) AS dist_m
        FROM {BQ_TABLE_NEIGHBORHOODS}
        ORDER BY dist_m ASC
        LIMIT 1
    """
    rows = list(client.query(query).result())
    if not rows:
        return {"neighborhood_slug": "UNKNOWN", "neighborhood_name": "Unknown"}
    row = rows[0]
    return {
        "neighborhood_slug": row["neighborhood_slug"],
        "neighborhood_name": row["neighborhood_name"],
    }


def fetch_region_id(client, neighborhood_slug: str) -> int:
    """
    Join neighborhood_slug with ref_neighborhood_districts_static to get region_id.
    """
    query = f"""
        SELECT region_id
        FROM {BQ_TABLE_NB_DISTRICTS}
        WHERE neighborhood_slug = '{neighborhood_slug}'
        LIMIT 1
    """
    rows = list(client.query(query).result())
    if not rows:
        return 10  # central Tehran as safe default
    return int(rows[0]["region_id"])


def fetch_spatial_features(client, lat: float, lon: float) -> dict:
    """
    Execute a combined spatial query to calculate all micro-model location features.
    Uses ST_GEOGPOINT, ST_DISTANCE, ST_DWITHIN with COALESCE fallbacks.
    """
    query = f"""
        WITH user_point AS (
            SELECT ST_GEOGPOINT({lon}, {lat}) AS pt
        ),

        -- Distance to nearest metro station
        metro_dist AS (
            SELECT MIN(
                ST_DISTANCE(
                    ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                    (SELECT pt FROM user_point)
                )
            ) AS dist
            FROM {BQ_TABLE_METRO}
        ),

        -- Distance to nearest highway
        highway_dist AS (
            SELECT MIN(
                ST_DISTANCE(
                    ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                    (SELECT pt FROM user_point)
                )
            ) AS dist
            FROM {BQ_TABLE_HIGHWAYS}
        ),

        -- Commercial density: count points within 500m radius
        comm_density AS (
            SELECT COUNT(*) AS cnt
            FROM {BQ_TABLE_COMMERCIAL}
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point),
                500
            )
        ),

        -- Urban decay: nearest point's class value
        urban_decay AS (
            SELECT decay_class
            FROM {BQ_TABLE_URBAN_DECAY}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC
            LIMIT 1
        ),

        -- Air quality: nearest point's AQI value
        air_quality AS (
            SELECT aqi
            FROM {BQ_TABLE_AIR_QUALITY}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC
            LIMIT 1
        ),

        -- Traffic zone: nearest point's status value
        traffic AS (
            SELECT zone_status
            FROM {BQ_TABLE_TRAFFIC}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC
            LIMIT 1
        ),

        -- Seismic risk: nearest point's risk level
        seismic AS (
            SELECT risk_level
            FROM {BQ_TABLE_SEISMIC}
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(CAST(longitude AS FLOAT64), CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC
            LIMIT 1
        )

        SELECT
            COALESCE((SELECT dist FROM metro_dist), {FALLBACK_DIST_MAX})       AS dist_to_metro,
            COALESCE((SELECT dist FROM highway_dist), {FALLBACK_DIST_MAX})     AS dist_to_highway,
            ST_DISTANCE(
                ST_GEOGPOINT({TEHRAN_CBD_LON}, {TEHRAN_CBD_LAT}),
                ST_GEOGPOINT({lon}, {lat})
            )                                                                    AS dist_to_cbd,
            COALESCE((SELECT cnt FROM comm_density), {FALLBACK_COMM_DENSITY})  AS commercial_density,
            COALESCE((SELECT decay_class FROM urban_decay), {FALLBACK_URBAN_DECAY}) AS urban_decay_class,
            COALESCE((SELECT aqi FROM air_quality), {FALLBACK_AIR_QUALITY})    AS air_quality_aqi,
            COALESCE((SELECT zone_status FROM traffic), {FALLBACK_TRAFFIC_ZONE}) AS traffic_zone_status,
            COALESCE((SELECT risk_level FROM seismic), {FALLBACK_SEISMIC_RISK}) AS seismic_risk_level
    """
    rows = list(client.query(query).result())
    if not rows:
        return {
            "dist_to_metro": FALLBACK_DIST_MAX,
            "dist_to_highway": FALLBACK_DIST_MAX,
            "dist_to_cbd": 0.0,
            "commercial_density": FALLBACK_COMM_DENSITY,
            "urban_decay_class": FALLBACK_URBAN_DECAY,
            "air_quality_aqi": FALLBACK_AIR_QUALITY,
            "traffic_zone_status": FALLBACK_TRAFFIC_ZONE,
            "seismic_risk_level": FALLBACK_SEISMIC_RISK,
        }
    row = rows[0]
    return {
        "dist_to_metro": float(row["dist_to_metro"]),
        "dist_to_highway": float(row["dist_to_highway"]),
        "dist_to_cbd": float(row["dist_to_cbd"]),
        "commercial_density": int(row["commercial_density"]),
        "urban_decay_class": int(row["urban_decay_class"]),
        "air_quality_aqi": float(row["air_quality_aqi"]),
        "traffic_zone_status": int(row["traffic_zone_status"]),
        "seismic_risk_level": int(row["seismic_risk_level"]),
    }


# ─────────────────────────────────────────────────────────
# SECTION C: Model loading
# ─────────────────────────────────────────────────────────
def load_models_and_encoding():
    """
    Load XGBoost models and neighborhood encoding JSON.
    Returns (macro_booster, micro_booster, encoding_dict).
    """
    import xgboost as xgb

    models_dir = os.path.join(os.path.dirname(__file__), "models")

    macro_path = os.path.join(models_dir, "macro_clean_model.json")
    micro_path = os.path.join(models_dir, "micro_model.json")
    encoding_path = os.path.join(models_dir, "neighborhood_encoding.json")

    for path in [macro_path, micro_path, encoding_path]:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Model file not found: {path}. "
                "Place macro_clean_model.json, micro_model.json, "
                "and neighborhood_encoding.json in /api/models/"
            )

    macro_booster = xgb.Booster()
    macro_booster.load_model(macro_path)

    micro_booster = xgb.Booster()
    micro_booster.load_model(micro_path)

    with open(encoding_path, "r", encoding="utf-8") as f:
        encoding_dict = json.load(f)

    return macro_booster, micro_booster, encoding_dict


# ─────────────────────────────────────────────────────────
# SECTION D: Feature engineering helpers
# ─────────────────────────────────────────────────────────
def engineer_micro_features(
    *,
    # Physical
    has_elevator: bool,
    has_parking: bool,
    has_warehouse: bool,
    is_rebuilt: bool,
    is_villa: bool,
    building_size: float,      # area in m²
    rooms_count: int,
    building_age: int,
    floor_num: int,
    total_floors: int,
    unit_per_floor: int,
    # Location
    lat: float,
    lon: float,
    # Spatial
    commercial_density: int,
    dist_to_metro: float,
    dist_to_cbd: float,
    dist_to_highway: float,
    seismic_risk_level: int,
    air_quality_aqi: float,
    traffic_zone_status: int,
    urban_decay_class: int,
    # Derived
    region_id: int,
    neighborhood_encoded: float,
) -> dict:
    """
    Compute all engineered features for the micro model.
    The feature names and engineering logic match the training pipeline.
    """

    # ── Engineered features ──

    # floor_elevator_penalty:
    #   Floors without elevator incur an accessibility penalty.
    #   Ground floor (0) has no penalty. Higher floors without elevator = worse.
    floor_elevator_penalty = floor_num * (1 - int(has_elevator))

    # value_retention_bonus:
    #   Rebuilt (renovated) units retain value better.
    #   Simple binary indicator scaled by inverse age factor.
    value_retention_bonus = int(is_rebuilt)

    # bonus_tod_livability:
    #   Transit-Oriented Development bonus: score decays with metro distance.
    #   Max bonus at 0m, zero benefit beyond 1500m.
    bonus_tod_livability = max(0.0, 1.0 - dist_to_metro / 1500.0)

    # penalty_traffic_nuisance:
    #   Higher traffic zone → lower livability.
    penalty_traffic_nuisance = float(traffic_zone_status)

    # suburban_metro_dependency:
    #   Far-from-CBD areas depend heavily on metro access.
    #   Captures interaction between metro distance and suburban location.
    suburban_flag = 1.0 if dist_to_cbd > 12000 else 0.0
    suburban_metro_dependency = (dist_to_metro / 1000.0) * suburban_flag

    # redevelopment_premium:
    #   Rebuilt units in high urban decay zones carry a premium
    #   (investors target distressed-area renovation opportunities).
    redevelopment_premium = int(is_rebuilt) * urban_decay_class

    # highway_sweetspot:
    #   Properties 200–900m from a highway benefit from connectivity
    #   without noise nuisance.
    highway_sweetspot = 1 if 200 <= dist_to_highway <= 900 else 0

    # land_size: for villas use building_size as proxy; for apartments = 0
    land_size = building_size if is_villa else 0.0

    # location_radius: precision radius of the pin (0 = exact user input)
    location_radius = 0.0

    # is_centroid_imputed: False — user supplied exact coordinates
    is_centroid_imputed = 0

    # is_price_converted: False — inference context
    is_price_converted = 0

    return {
        # ── Exact feature order for micro model DMatrix ──
        "has_elevator": int(has_elevator),
        "has_parking": int(has_parking),
        "has_warehouse": int(has_warehouse),
        "is_rebuilt": int(is_rebuilt),
        "is_centroid_imputed": is_centroid_imputed,
        "is_price_converted": is_price_converted,
        "is_villa": int(is_villa),
        "land_size": land_size,
        "building_size": building_size,
        "rooms_count": rooms_count,
        "building_age": building_age,
        "location_latitude": lat,
        "location_longitude": lon,
        "location_radius": location_radius,
        "commercial_density": commercial_density,
        "dist_to_metro": dist_to_metro,
        "dist_to_cbd": dist_to_cbd,
        "dist_to_highway": dist_to_highway,
        "seismic_risk_level": seismic_risk_level,
        "air_quality_aqi": air_quality_aqi,
        "traffic_zone_status": traffic_zone_status,
        "urban_decay_class": urban_decay_class,
        "floor_elevator_penalty": floor_elevator_penalty,
        "value_retention_bonus": value_retention_bonus,
        "bonus_tod_livability": bonus_tod_livability,
        "penalty_traffic_nuisance": penalty_traffic_nuisance,
        "suburban_metro_dependency": suburban_metro_dependency,
        "redevelopment_premium": redevelopment_premium,
        "highway_sweetspot": highway_sweetspot,
        "region_id": region_id,
        "floor_num": floor_num,
        "total_floors_num": total_floors,
        "unit_per_floor_num": unit_per_floor,
        "neighborhood_encoded": neighborhood_encoded,
    }


def build_macro_features(
    *,
    year_jalali: int,
    usd_live: float,
    tedpix_live: float,
    usd_lag_1: float,
    usd_lag_3: float,
    usd_lag_6: float,
    tedpix_lag_3: float,
    region_id: int,
) -> list:
    """
    Build the macro model feature vector with one-hot encoded region_id.
    Region IDs 1–22 are one-hot encoded.
    Exact column order:
        ['Year_Jalali', 'USD_Free_Market', 'TEDPIX_Index',
         'USD_Free_Market_Lag_1', 'USD_Free_Market_Lag_3', 'USD_Free_Market_Lag_6',
         'TEDPIX_Index_Lag_3',
         'region_id_1', ..., 'region_id_22']
    """
    region_ohe = {f"region_id_{i}": 0 for i in range(1, 23)}
    if 1 <= region_id <= 22:
        region_ohe[f"region_id_{region_id}"] = 1

    feature_vector = [
        year_jalali,
        usd_live,
        tedpix_live,
        usd_lag_1,
        usd_lag_3,
        usd_lag_6,
        tedpix_lag_3,
    ] + [region_ohe[f"region_id_{i}"] for i in range(1, 23)]

    return feature_vector


# ─────────────────────────────────────────────────────────
# SECTION E: Request handler (Vercel serverless)
# ─────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self._handle()

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle(self):
        try:
            # ── Parse request body ──
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length)
            body = json.loads(raw_body)

            lat = float(body["lat"])
            lon = float(body["lon"])
            area = float(body["area"])
            building_age = int(body.get("building_age", 10))
            total_floors = int(body.get("total_floors", 6))
            floor_num = int(body.get("floor_num", 2))
            unit_per_floor = int(body.get("unit_per_floor", 2))
            rooms_count = int(body.get("rooms_count", 2))
            has_elevator = bool(body.get("has_elevator", True))
            has_parking = bool(body.get("has_parking", True))
            has_warehouse = bool(body.get("has_warehouse", False))
            is_rebuilt = bool(body.get("is_rebuilt", False))
            is_villa = bool(body.get("is_villa", False))

        except (KeyError, ValueError, json.JSONDecodeError) as e:
            self._send_json(400, {"error": f"Invalid request payload: {e}"})
            return

        try:
            import pandas as pd
            import xgboost as xgb

            # ────────────────────────────────────────
            # STEP A: Scrape live economic data
            # ────────────────────────────────────────
            print("[A] Scraping live USD/TEDPIX...")
            live_rates = scrape_live_rates()
            live_usd = live_rates.get("usd")
            live_tedpix = live_rates.get("tedpix")

            # ────────────────────────────────────────
            # STEP B: BigQuery queries
            # ────────────────────────────────────────
            print("[B] Connecting to BigQuery...")
            client = get_bq_client()

            # B1: Latest macro row → lag features
            print("[B1] Fetching latest macro row...")
            macro_row = fetch_latest_macro_row(client)

            # If live scrape failed, fall back to BigQuery row values
            if live_usd is None or live_usd <= 0:
                print("[B1] Live USD scrape failed; using BigQuery fallback.")
                live_usd = macro_row["USD_Free_Market"]
            if live_tedpix is None or live_tedpix <= 0:
                print("[B1] Live TEDPIX scrape failed; using BigQuery fallback.")
                live_tedpix = macro_row["TEDPIX_Index"]

            year_jalali = int(macro_row["Year_Jalali"])
            usd_lag_1 = float(macro_row["USD_Free_Market_Lag_1"])
            usd_lag_3 = float(macro_row["USD_Free_Market_Lag_3"])
            usd_lag_6 = float(macro_row["USD_Free_Market_Lag_6"])
            tedpix_lag_3 = float(macro_row["TEDPIX_Index_Lag_3"])

            # B2: Nearest neighborhood centroid
            print("[B2] Finding nearest neighborhood...")
            nb_info = fetch_nearest_neighborhood(client, lat, lon)
            neighborhood_slug = nb_info["neighborhood_slug"]
            neighborhood_name = nb_info.get("neighborhood_name", neighborhood_slug)

            # B3: Region ID
            print("[B3] Fetching region_id...")
            region_id = fetch_region_id(client, neighborhood_slug)

            # B4: Spatial features
            print("[B4] Calculating spatial features...")
            spatial = fetch_spatial_features(client, lat, lon)

            # ────────────────────────────────────────
            # STEP C: Load models + encoding
            # ────────────────────────────────────────
            print("[C] Loading models...")
            macro_booster, micro_booster, encoding_dict = load_models_and_encoding()

            global_mean = float(encoding_dict.get("GLOBAL_MEAN", 1.0))
            neighborhood_encoded = float(
                encoding_dict.get(neighborhood_slug, global_mean)
            )
            print(f"[C] neighborhood_slug={neighborhood_slug!r}, encoded={neighborhood_encoded:.4f}")

            # ────────────────────────────────────────
            # STEP D: Inference
            # ────────────────────────────────────────
            print("[D] Running inference...")

            # ── Macro model ──
            macro_features = build_macro_features(
                year_jalali=year_jalali,
                usd_live=live_usd,
                tedpix_live=live_tedpix,
                usd_lag_1=usd_lag_1,
                usd_lag_3=usd_lag_3,
                usd_lag_6=usd_lag_6,
                tedpix_lag_3=tedpix_lag_3,
                region_id=region_id,
            )

            macro_columns = (
                ["Year_Jalali", "USD_Free_Market", "TEDPIX_Index",
                 "USD_Free_Market_Lag_1", "USD_Free_Market_Lag_3",
                 "USD_Free_Market_Lag_6", "TEDPIX_Index_Lag_3"]
                + [f"region_id_{i}" for i in range(1, 23)]
            )
            macro_df = pd.DataFrame([macro_features], columns=macro_columns)
            macro_dmatrix = xgb.DMatrix(macro_df)
            base_price_per_sqm = float(macro_booster.predict(macro_dmatrix)[0])

            # ── Micro model ──
            micro_feat_dict = engineer_micro_features(
                has_elevator=has_elevator,
                has_parking=has_parking,
                has_warehouse=has_warehouse,
                is_rebuilt=is_rebuilt,
                is_villa=is_villa,
                building_size=area,
                rooms_count=rooms_count,
                building_age=building_age,
                floor_num=floor_num,
                total_floors=total_floors,
                unit_per_floor=unit_per_floor,
                lat=lat,
                lon=lon,
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

            # Exact column order for micro model (must match training)
            micro_columns = [
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
            micro_df = pd.DataFrame(
                [[micro_feat_dict[col] for col in micro_columns]],
                columns=micro_columns,
            )
            micro_dmatrix = xgb.DMatrix(micro_df)
            quality_ratio = float(micro_booster.predict(micro_dmatrix)[0])

            # ── Final price calculation ──
            final_price_per_sqm = base_price_per_sqm * quality_ratio
            final_total_price = final_price_per_sqm * area

            print(
                f"[D] base={base_price_per_sqm:,.0f} × ratio={quality_ratio:.4f} "
                f"× area={area} = total={final_total_price:,.0f}"
            )

            # ── Response ──
            response_payload = {
                "base_price_per_sqm": round(base_price_per_sqm, 2),
                "quality_ratio": round(quality_ratio, 6),
                "final_price_per_sqm": round(final_price_per_sqm, 2),
                "final_total_price": round(final_total_price, 2),
                "usd_rate": round(live_usd, 2),
                "tedpix": round(live_tedpix, 2),
                "neighborhood": neighborhood_slug,
                "neighborhood_name": neighborhood_name,
                "region_id": region_id,
                "year_jalali": year_jalali,
                "spatial": {
                    "dist_to_metro_m": round(spatial["dist_to_metro"], 1),
                    "dist_to_cbd_m": round(spatial["dist_to_cbd"], 1),
                    "dist_to_highway_m": round(spatial["dist_to_highway"], 1),
                    "commercial_density": spatial["commercial_density"],
                    "seismic_risk_level": spatial["seismic_risk_level"],
                    "air_quality_aqi": spatial["air_quality_aqi"],
                    "traffic_zone_status": spatial["traffic_zone_status"],
                    "urban_decay_class": spatial["urban_decay_class"],
                },
            }
            self._send_json(200, response_payload)

        except FileNotFoundError as e:
            print(f"[ERROR] Model file missing: {e}")
            self._send_json(500, {"error": str(e)})
        except EnvironmentError as e:
            print(f"[ERROR] Auth/env error: {e}")
            self._send_json(500, {"error": str(e)})
        except Exception as e:
            tb = traceback.format_exc()
            print(f"[ERROR] Unexpected error:\n{tb}")
            self._send_json(500, {"error": f"Prediction failed: {str(e)}"})
