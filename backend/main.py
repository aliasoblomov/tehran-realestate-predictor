"""
Tehran Real Estate Price Prediction — FastAPI Backend V2
backend/main.py
"""

import json
import os
import math
import re
import traceback
import threading
from contextlib import asynccontextmanager
from typing import Optional, List

import numpy as np
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── CONSTANTS ──────────────────────────────────────────────────────────────────
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

# ─── NEIGHBORHOOD DATA ───────────────────────────────────────────────────────────
NEIGHBORHOODS_DATA = [
  {"slug": "tajrish", "region_id": 1, "lat": 35.802185, "lon": 51.431004},
  {"slug": "elahiyeh", "region_id": 1, "lat": 35.790916, "lon": 51.426933},
  {"slug": "zafaraniyeh", "region_id": 1, "lat": 35.809017, "lon": 51.414654},
  {"slug": "mahmoodiyeh", "region_id": 1, "lat": 35.795753, "lon": 51.412777},
  {"slug": "velenjak", "region_id": 1, "lat": 35.805008, "lon": 51.40098},
  {"slug": "evin", "region_id": 1, "lat": 35.798706, "lon": 51.39322},
  {"slug": "darakeh", "region_id": 1, "lat": 35.806396, "lon": 51.38392},
  {"slug": "aghdasieh", "region_id": 1, "lat": 35.804657, "lon": 51.476944},
  {"slug": "ajoodanieh", "region_id": 1, "lat": 35.806793, "lon": 51.48422},
  {"slug": "darabad", "region_id": 1, "lat": 35.81159, "lon": 51.49072},
  {"slug": "niavaran", "region_id": 1, "lat": 35.817665, "lon": 51.469242},
  {"slug": "jamaran", "region_id": 1, "lat": 35.81823, "lon": 51.45895},
  {"slug": "hesar-booali", "region_id": 1, "lat": 35.805046, "lon": 51.468655},
  {"slug": "chizar", "region_id": 1, "lat": 35.798313, "lon": 51.455593},
  {"slug": "qeytariyeh", "region_id": 1, "lat": 35.790344, "lon": 51.44359},
  {"slug": "bagh-ferdows", "region_id": 1, "lat": 35.803352, "lon": 51.424007},
  {"slug": "golab-dareh", "region_id": 1, "lat": 35.819225, "lon": 51.439796},
  {"slug": "emamzade-ghasem", "region_id": 1, "lat": 35.812515, "lon": 51.440018},
  {"slug": "kamraniyeh", "region_id": 1, "lat": 35.806644, "lon": 51.46268},
  {"slug": "farmaniyeh", "region_id": 1, "lat": 35.79588, "lon": 51.471874},
  {"slug": "dezashib", "region_id": 1, "lat": 35.808712, "lon": 51.4531},
  {"slug": "darband", "region_id": 1, "lat": 35.81608, "lon": 51.427116},
  {"slug": "saadat-abad", "region_id": 2, "lat": 35.781883, "lon": 51.3749},
  {"slug": "eivanak", "region_id": 2, "lat": 35.756733, "lon": 51.35456},
  {"slug": "kuy-faraz", "region_id": 2, "lat": 35.796703, "lon": 51.371002},
  {"slug": "aseman", "region_id": 2, "lat": 35.778248, "lon": 51.35162},
  {"slug": "darya", "region_id": 2, "lat": 35.771034, "lon": 51.37821},
  {"slug": "sharara", "region_id": 2, "lat": 35.71979, "lon": 51.37151},
  {"slug": "marzdaran", "region_id": 2, "lat": 35.739033, "lon": 51.34062},
  {"slug": "gisha", "region_id": 2, "lat": 35.738556, "lon": 51.37743},
  {"slug": "tehranvila", "region_id": 2, "lat": 35.7226, "lon": 51.366577},
  {"slug": "sattarkhan", "region_id": 2, "lat": 35.723278, "lon": 51.356926},
  {"slug": "tarasht", "region_id": 2, "lat": 35.706665, "lon": 51.34296},
  {"slug": "farahzad", "region_id": 2, "lat": 35.789047, "lon": 51.34448},
  {"slug": "parvaz", "region_id": 2, "lat": 35.789352, "lon": 51.3541},
  {"slug": "shadman", "region_id": 2, "lat": 35.70762, "lon": 51.36435},
  {"slug": "vanak", "region_id": 3, "lat": 35.756386, "lon": 51.39823},
  {"slug": "amaniyeh", "region_id": 3, "lat": 35.778667, "lon": 51.419865},
  {"slug": "jordan", "region_id": 3, "lat": 35.765583, "lon": 51.412327},
  {"slug": "gandi", "region_id": 3, "lat": 35.749237, "lon": 51.416668},
  {"slug": "tavanir", "region_id": 3, "lat": 35.745815, "lon": 51.408955},
  {"slug": "zargandeh", "region_id": 3, "lat": 35.776695, "lon": 51.432632},
  {"slug": "qoba", "region_id": 3, "lat": 35.76101, "lon": 51.44923},
  {"slug": "ekhtiyariyeh", "region_id": 3, "lat": 35.786255, "lon": 51.460365},
  {"slug": "darrous", "region_id": 3, "lat": 35.773624, "lon": 51.456184},
  {"slug": "pasdaran", "region_id": 3, "lat": 35.772717, "lon": 51.468},
  {"slug": "seyed-khandan", "region_id": 3, "lat": 35.748585, "lon": 51.456993},
  {"slug": "gholhak", "region_id": 3, "lat": 35.773624, "lon": 51.444397},
  {"slug": "zafar", "region_id": 3, "lat": 35.76571, "lon": 51.4332},
  {"slug": "east-tehranpars", "region_id": 4, "lat": 35.74096, "lon": 51.547},
  {"slug": "west-tehranpars", "region_id": 4, "lat": 35.735928, "lon": 51.527725},
  {"slug": "hakimiyeh", "region_id": 4, "lat": 35.73933, "lon": 51.587807},
  {"slug": "lavizan", "region_id": 4, "lat": 35.77224, "lon": 51.51327},
  {"slug": "shian", "region_id": 4, "lat": 35.76552, "lon": 51.50049},
  {"slug": "khak-sefid", "region_id": 4, "lat": 35.742546, "lon": 51.56312},
  {"slug": "heravi", "region_id": 4, "lat": 35.76387, "lon": 51.474365},
  {"slug": "poonak", "region_id": 5, "lat": 35.762077, "lon": 51.331444},
  {"slug": "shahin", "region_id": 5, "lat": 35.761795, "lon": 51.31473},
  {"slug": "bagh-feyz", "region_id": 5, "lat": 35.744724, "lon": 51.322525},
  {"slug": "sadeghiyeh", "region_id": 5, "lat": 35.719387, "lon": 51.342903},
  {"slug": "ekbatan", "region_id": 5, "lat": 35.70816, "lon": 51.304195},
  {"slug": "shahr-e-ziba", "region_id": 5, "lat": 35.748688, "lon": 51.291924},
  {"slug": "south-shahran", "region_id": 5, "lat": 35.758667, "lon": 51.290768},
  {"slug": "north-shahran", "region_id": 5, "lat": 35.768, "lon": 51.282},
  {"slug": "central-janat-abad", "region_id": 5, "lat": 35.75906, "lon": 51.303818},
  {"slug": "north-janat-abad", "region_id": 5, "lat": 35.77209, "lon": 51.30841},
  {"slug": "south-janat-abad", "region_id": 5, "lat": 35.745792, "lon": 51.305984},
  {"slug": "kan", "region_id": 5, "lat": 35.758373, "lon": 51.278584},
  {"slug": "amir-abad", "region_id": 6, "lat": 35.735477, "lon": 51.390358},
  {"slug": "yousef-abad", "region_id": 6, "lat": 35.73621, "lon": 51.40563},
  {"slug": "nosrat", "region_id": 6, "lat": 35.706745, "lon": 51.38434},
  {"slug": "bolvar-e-keshavarz", "region_id": 6, "lat": 35.71367, "lon": 51.399075},
  {"slug": "tehran-university", "region_id": 6, "lat": 35.705254, "lon": 51.39762},
  {"slug": "enqelab", "region_id": 6, "lat": 35.69842, "lon": 51.402332},
  {"slug": "jahad", "region_id": 6, "lat": 35.72464, "lon": 51.403404},
  {"slug": "behjat-abad", "region_id": 6, "lat": 35.71929, "lon": 51.412136},
  {"slug": "iranshahr", "region_id": 6, "lat": 35.708656, "lon": 51.42204},
  {"slug": "arjantin", "region_id": 6, "lat": 35.73532, "lon": 51.415684},
  {"slug": "motahari", "region_id": 6, "lat": 35.72147, "lon": 51.420944},
  {"slug": "valiasr", "region_id": 6, "lat": 35.706383, "lon": 51.408028},
  {"slug": "niloufar", "region_id": 7, "lat": 35.73617, "lon": 51.43405},
  {"slug": "bahar", "region_id": 7, "lat": 35.71066, "lon": 51.43321},
  {"slug": "heshamatiyeh", "region_id": 7, "lat": 35.72613, "lon": 51.449997},
  {"slug": "tehran-gorgan", "region_id": 7, "lat": 35.709583, "lon": 51.450798},
  {"slug": "east-shareq", "region_id": 7, "lat": 35.711483, "lon": 51.4654},
  {"slug": "dabestan", "region_id": 7, "lat": 35.73596, "lon": 51.45444},
  {"slug": "nezam-abad", "region_id": 7, "lat": 35.707832, "lon": 51.455956},
  {"slug": "abbas-abad", "region_id": 7, "lat": 35.72766, "lon": 51.434525},
  {"slug": "emam-hossein", "region_id": 7, "lat": 35.701984, "lon": 51.447834},
  {"slug": "north-sohrevardi", "region_id": 7, "lat": 35.7209, "lon": 51.43482},
  {"slug": "narmak", "region_id": 8, "lat": 35.72764, "lon": 51.49703},
  {"slug": "haft-hoz", "region_id": 8, "lat": 35.728413, "lon": 51.489872},
  {"slug": "dardasht", "region_id": 8, "lat": 35.72881, "lon": 51.506668},
  {"slug": "fadak", "region_id": 8, "lat": 35.72777, "lon": 51.481144},
  {"slug": "sabalan", "region_id": 8, "lat": 35.724483, "lon": 51.463333},
  {"slug": "majidiyeh", "region_id": 8, "lat": 35.735565, "lon": 51.466454},
  {"slug": "dr-hoshyar", "region_id": 9, "lat": 35.694195, "lon": 51.35093},
  {"slug": "shahid-dastgheyb", "region_id": 9, "lat": 35.686527, "lon": 51.348297},
  {"slug": "sar-asiyab-mehr-abad", "region_id": 9, "lat": 35.671803, "lon": 51.329636},
  {"slug": "fath", "region_id": 9, "lat": 35.677116, "lon": 51.300945},
  {"slug": "jey", "region_id": 9, "lat": 35.67895, "lon": 51.34921},
  {"slug": "soleymani", "region_id": 10, "lat": 35.672226, "lon": 51.36379},
  {"slug": "sarsabil", "region_id": 10, "lat": 35.690144, "lon": 51.37454},
  {"slug": "beryanak", "region_id": 10, "lat": 35.674942, "lon": 51.377117},
  {"slug": "haftchenar", "region_id": 10, "lat": 35.676014, "lon": 51.37015},
  {"slug": "jeyhoun", "region_id": 10, "lat": 35.69009, "lon": 51.366905},
  {"slug": "azarbaijan", "region_id": 10, "lat": 35.69893, "lon": 51.371666},
  {"slug": "moniriyeh", "region_id": 11, "lat": 35.684074, "lon": 51.40128},
  {"slug": "amiriyeh", "region_id": 11, "lat": 35.678253, "lon": 51.400852},
  {"slug": "sheykh-hadi", "region_id": 11, "lat": 35.69147, "lon": 51.401955},
  {"slug": "hassan-abad", "region_id": 11, "lat": 35.68538, "lon": 51.408707},
  {"slug": "jomhouri", "region_id": 11, "lat": 35.697258, "lon": 51.381992},
  {"slug": "ferdowsi", "region_id": 12, "lat": 35.693672, "lon": 51.418297},
  {"slug": "pamenar", "region_id": 12, "lat": 35.68142, "lon": 51.424812},
  {"slug": "sirous", "region_id": 12, "lat": 35.67233, "lon": 51.433224},
  {"slug": "bazaar", "region_id": 12, "lat": 35.672733, "lon": 51.422565},
  {"slug": "baharestan", "region_id": 12, "lat": 35.69453, "lon": 51.429886},
  {"slug": "pirouzi", "region_id": 13, "lat": 35.69542, "lon": 51.486427},
  {"slug": "tehran-no", "region_id": 13, "lat": 35.710094, "lon": 51.496353},
  {"slug": "shahed", "region_id": 13, "lat": 35.673138, "lon": 51.47699},
  {"slug": "farah-abad", "region_id": 13, "lat": 35.680187, "lon": 51.486183},
  {"slug": "shokoofeh", "region_id": 14, "lat": 35.68404, "lon": 51.448647},
  {"slug": "charsad-dastgah", "region_id": 14, "lat": 35.686466, "lon": 51.46149},
  {"slug": "doolab", "region_id": 14, "lat": 35.665924, "lon": 51.4608},
  {"slug": "ahang", "region_id": 14, "lat": 35.663185, "lon": 51.476677},
  {"slug": "nabi-akram", "region_id": 14, "lat": 35.682953, "lon": 51.476208},
  {"slug": "afsariyeh", "region_id": 15, "lat": 35.650806, "lon": 51.49224},
  {"slug": "moshiriyeh", "region_id": 15, "lat": 35.625053, "lon": 51.47763},
  {"slug": "atabak", "region_id": 15, "lat": 35.64931, "lon": 51.46269},
  {"slug": "khavaran", "region_id": 15, "lat": 35.665424, "lon": 51.453148},
  {"slug": "abouzar", "region_id": 15, "lat": 35.65072, "lon": 51.47706},
  {"slug": "nazi-abad", "region_id": 16, "lat": 35.64138, "lon": 51.405453},
  {"slug": "yakhchi-abad", "region_id": 16, "lat": 35.6263, "lon": 51.405384},
  {"slug": "khazaneh", "region_id": 16, "lat": 35.638935, "lon": 51.426044},
  {"slug": "javadiyeh", "region_id": 16, "lat": 35.64976, "lon": 51.39022},
  {"slug": "fallah", "region_id": 17, "lat": 35.659267, "lon": 51.367393},
  {"slug": "jalili", "region_id": 17, "lat": 35.650494, "lon": 51.362106},
  {"slug": "zamzam", "region_id": 17, "lat": 35.647903, "lon": 51.36774},
  {"slug": "imamzadeh-hasan", "region_id": 17, "lat": 35.6654, "lon": 51.36076},
  {"slug": "azari", "region_id": 17, "lat": 35.666626, "lon": 51.350796},
  {"slug": "yaftabad", "region_id": 18, "lat": 35.642033, "lon": 51.301575},
  {"slug": "shadabad", "region_id": 18, "lat": 35.65688, "lon": 51.30141},
  {"slug": "shahrak-e-ferdows", "region_id": 18, "lat": 35.66301, "lon": 51.32534},
  {"slug": "khani-abad-no", "region_id": 19, "lat": 35.625195, "lon": 51.39237},
  {"slug": "abdol-abad", "region_id": 19, "lat": 35.630436, "lon": 51.36584},
  {"slug": "nemat-abad", "region_id": 19, "lat": 35.62986, "lon": 51.35257},
  {"slug": "dolatkhah", "region_id": 19, "lat": 35.618443, "lon": 51.342953},
  {"slug": "east-saleh-abad", "region_id": 20, "lat": 35.61, "lon": 51.39},
  {"slug": "south-deylaman", "region_id": 20, "lat": 35.603333, "lon": 51.432556},
  {"slug": "hamzeh-abad", "region_id": 20, "lat": 35.597504, "lon": 51.42369},
  {"slug": "firoozabadi", "region_id": 20, "lat": 35.59539, "lon": 51.433235},
  {"slug": "tehransar", "region_id": 21, "lat": 35.692574, "lon": 51.254623},
  {"slug": "shahrak-e-azadi", "region_id": 21, "lat": 35.709427, "lon": 51.273167},
  {"slug": "shahrak-e-darya", "region_id": 21, "lat": 35.685604, "lon": 51.238903},
  {"slug": "shahrak-farhangian", "region_id": 21, "lat": 35.7092, "lon": 51.285786},
  {"slug": "chitgar", "region_id": 22, "lat": 35.718536, "lon": 51.162716},
  {"slug": "chitgar-lake", "region_id": 22, "lat": 35.738773, "lon": 51.206615},
  {"slug": "kuhak", "region_id": 22, "lat": 35.726765, "lon": 51.2347},
  {"slug": "dehkade-olympic", "region_id": 22, "lat": 35.7641, "lon": 51.255024},
  {"slug": "azad-shahr", "region_id": 22, "lat": 35.746273, "lon": 51.175713},
]

# ─── MODEL FEATURE COLUMNS ───────────────────────────────────────────────────────
MACRO_COLUMNS = [
    "USD_Return_1M", "USD_Return_3M", "USD_Return_12M", "USD_MA_Ratio_12",
    "USD_Acceleration", "Housing_to_USD_Lag_1", "Housing_to_USD_Lag_3",
    "Housing_to_USD_Lag_12", "Housing_to_USD_ZScore_Lag_1", "Coin_Bubble",
    "Iran_GPR", "Iran_GPR_MA3", "M2_Growth_YoY_Lag_3", "M2_Growth_Acceleration",
    "Monetary_Excess", "Inflation_General_YoY_Lag_3", "TEDPIX_Return_3M",
    "Construction_Cost_Real", "Month_Sin", "Month_Cos",
]

MICRO_COLUMNS = [
    "has_elevator", "has_parking", "is_price_converted", "is_villa",
    "land_size", "building_size", "rooms_count", "building_age",
    "location_latitude", "location_longitude", "location_radius",
    "commercial_density", "dist_to_metro", "dist_to_cbd", "dist_to_highway",
    "seismic_risk_level", "air_quality_aqi", "traffic_zone_status",
    "urban_decay_class", "floor_elevator_penalty", "bonus_tod_livability",
    "penalty_traffic_nuisance", "suburban_metro_dependency", "highway_sweetspot",
    "region_id", "floor_num", "total_floors_num", "unit_per_floor_num",
    "neighborhood_encoded",
]


# ─── HELPERS ────────────────────────────────────────────────────────────────────
def haversine_distance_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_top_candidate_neighborhoods(lat: float, lon: float, top_k: int = 3) -> list:
    candidates = []
    for item in NEIGHBORHOODS_DATA:
        dist = haversine_distance_km(lat, lon, item["lat"], item["lon"])
        candidates.append({
            "slug": item["slug"],
            "region_id": item["region_id"],
            "distance_km": round(dist, 2),
            "name": item["slug"].replace("-", " ").title(),
        })
    candidates.sort(key=lambda x: x["distance_km"])
    return candidates[:top_k]


def fetch_region_id_from_borders(client, lat: float, lon: float) -> Optional[int]:
    strip_z = (
        "REGEXP_REPLACE("
        "REPLACE(REPLACE(geometry_wkt, ' Z', ''), ' ZM', ''), "
        r"r'([0-9eE.\-]+\s+[0-9eE.\-]+)\s+[0-9eE.\-]+(?:\s+[0-9eE.\-]+)?', "
        r"r'\1')"
    )
    query = f"""
        SELECT district_name
        FROM `{BQ_DATASET}.ref_tehran_borders`
        WHERE SAFE.ST_WITHIN(
            ST_GEOGPOINT({lon}, {lat}),
            SAFE.ST_GEOGFROMTEXT({strip_z})
        ) IS TRUE
        LIMIT 1
    """
    try:
        rows = list(client.query(query).result())
        if rows and rows[0]["district_name"]:
            dname = str(rows[0]["district_name"])
            match = re.search(r'\d+', dname)
            if match:
                return int(match.group())
    except Exception as e:
        print(f"[region_borders_error] {e}")
    return None


def fetch_latest_macro_row(client) -> dict:
    query = f"""
        SELECT *
        FROM `{BQ_DATASET}.macro_training_v2`
        ORDER BY Year_Jalali DESC, Month_Jalali DESC
        LIMIT 1
    """
    rows = list(client.query(query).result())
    if not rows:
        raise ValueError("macro_training_v2 returned no rows.")
    return dict(rows[0].items())


def fetch_spatial_features(client, lat: float, lon: float) -> dict:
    strip_z = (
        "REGEXP_REPLACE("
        "REPLACE(REPLACE(geometry_wkt, ' Z', ''), ' ZM', ''), "
        r"r'([0-9eE.\-]+\s+[0-9eE.\-]+)\s+[0-9eE.\-]+(?:\s+[0-9eE.\-]+)?', "
        r"r'\1')"
    )
    query = f"""
        WITH user_point AS (SELECT ST_GEOGPOINT({lon}, {lat}) AS pt),
        metro_calc AS (
            SELECT MIN(ST_DISTANCE(
                ST_GEOGPOINT(SAFE_CAST(longitude AS FLOAT64), SAFE_CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            )) AS dist
            FROM `{BQ_DATASET}.ref_metro_stations`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(SAFE_CAST(longitude AS FLOAT64), SAFE_CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 10000
            )
        ),
        hwy_geom AS (
            SELECT SAFE.ST_GEOGFROMTEXT({strip_z}) AS geom
            FROM `{BQ_DATASET}.ref_highways`
            WHERE SAFE.ST_GEOGFROMTEXT({strip_z}) IS NOT NULL
        ),
        hwy_calc AS (
            SELECT MIN(ST_DISTANCE(h.geom, (SELECT pt FROM user_point))) AS dist
            FROM hwy_geom h
            WHERE ST_DWITHIN(h.geom, (SELECT pt FROM user_point), 5000)
        ),
        comm_calc AS (
            SELECT COUNT(*) AS cnt
            FROM `{BQ_DATASET}.ref_commercial_points`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(SAFE_CAST(longitude AS FLOAT64), SAFE_CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 500
            )
        ),
        decay_geom AS (
            SELECT
                SAFE.ST_GEOGFROMTEXT({strip_z}) AS geom,
                CASE
                    WHEN decay_zone_name = '\u0641\u0631\u0633\u0648\u062f\u0647' THEN 4
                    WHEN decay_zone_name LIKE '%-%' THEN 3
                    WHEN decay_zone_name IN ('\u0631\u06cc\u0632\u062f\u0627\u0646\u06af\u06cc', '\u0646\u0627\u067e\u0627\u06cc\u062f\u0627\u0631\u06cc', '\u0646\u0641\u0648\u0630\u0646\u0627\u067e\u0630\u06cc\u0631\u06cc') THEN 2
                    WHEN decay_zone_name = '\u0633\u0627\u06cc\u0631' THEN 1
                    ELSE 0
                END AS decay_class
            FROM `{BQ_DATASET}.ref_urban_decay`
            WHERE SAFE.ST_GEOGFROMTEXT({strip_z}) IS NOT NULL
        ),
        decay_calc AS (
            SELECT MAX(d.decay_class) AS decay_class
            FROM decay_geom d
            WHERE ST_INTERSECTS(d.geom, (SELECT pt FROM user_point))
        ),
        aqi_calc AS (
            SELECT long_term_aqi AS aqi
            FROM `{BQ_DATASET}.ref_air_quality`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(SAFE_CAST(longitude AS FLOAT64), SAFE_CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 20000
            )
            ORDER BY ST_DISTANCE(
                ST_GEOGPOINT(SAFE_CAST(longitude AS FLOAT64), SAFE_CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point)
            ) ASC
            LIMIT 1
        ),
        traffic_geom AS (
            SELECT
                SAFE.ST_GEOGFROMTEXT({strip_z}) AS geom,
                SAFE_CAST(traffic_zone_status AS INT64) AS traffic_score
            FROM `{BQ_DATASET}.ref_traffic_zones`
            WHERE SAFE.ST_GEOGFROMTEXT({strip_z}) IS NOT NULL
        ),
        traffic_calc AS (
            SELECT MAX(t.traffic_score) AS traffic_score
            FROM traffic_geom t
            WHERE ST_INTERSECTS(t.geom, (SELECT pt FROM user_point))
        ),
        seismic_calc AS (
            SELECT ROUND(AVG(SAFE_CAST(seismic_risk_level AS INT64))) AS seismic_risk
            FROM `{BQ_DATASET}.ref_seismic_risk`
            WHERE ST_DWITHIN(
                ST_GEOGPOINT(SAFE_CAST(longitude AS FLOAT64), SAFE_CAST(latitude AS FLOAT64)),
                (SELECT pt FROM user_point), 500
            )
        )
        SELECT
            COALESCE((SELECT dist FROM metro_calc),    10000.0) AS dist_to_metro,
            COALESCE((SELECT dist FROM hwy_calc),       5000.0) AS dist_to_highway,
            ST_DISTANCE(ST_GEOGPOINT({TEHRAN_CBD_LON},{TEHRAN_CBD_LAT}),
                        ST_GEOGPOINT({lon},{lat}))              AS dist_to_cbd,
            COALESCE((SELECT cnt FROM comm_calc),            0) AS commercial_density,
            COALESCE((SELECT decay_class FROM decay_calc),   0) AS urban_decay_class,
            COALESCE((SELECT aqi FROM aqi_calc),           0.0) AS air_quality_aqi,
            COALESCE((SELECT traffic_score FROM traffic_calc), 0) AS traffic_zone_status,
            COALESCE((SELECT seismic_risk FROM seismic_calc),  1) AS seismic_risk_level
    """
    try:
        rows = list(client.query(query).result())
    except Exception as e:
        print(f"[fetch_spatial_features_error] {e}")
        rows = []
    if not rows:
        return {
            "dist_to_metro": FALLBACK_DIST_MAX,
            "dist_to_highway": FALLBACK_DIST_MAX,
            "dist_to_cbd": math.hypot(lat - TEHRAN_CBD_LAT, lon - TEHRAN_CBD_LON) * 111000,
            "commercial_density": FALLBACK_COMM_DENSITY,
            "urban_decay_class": FALLBACK_URBAN_DECAY,
            "air_quality_aqi": FALLBACK_AIR_QUALITY,
            "traffic_zone_status": FALLBACK_TRAFFIC_ZONE,
            "seismic_risk_level": FALLBACK_SEISMIC_RISK,
        }
    r = dict(rows[0].items())
    return {
        "dist_to_metro":      float(r["dist_to_metro"]      or FALLBACK_DIST_MAX),
        "dist_to_highway":    float(r["dist_to_highway"]    or FALLBACK_DIST_MAX),
        "dist_to_cbd":        float(r["dist_to_cbd"]        or 10000.0),
        "commercial_density": int(r["commercial_density"]   or FALLBACK_COMM_DENSITY),
        "urban_decay_class":  int(r["urban_decay_class"]    or FALLBACK_URBAN_DECAY),
        "air_quality_aqi":    float(r["air_quality_aqi"]    or FALLBACK_AIR_QUALITY),
        "traffic_zone_status":int(r["traffic_zone_status"]  or FALLBACK_TRAFFIC_ZONE),
        "seismic_risk_level": int(r["seismic_risk_level"]   or FALLBACK_SEISMIC_RISK),
    }


def build_macro_features(row: dict) -> list:
    return [
        float(row["USD_Return_1M"]),
        float(row["USD_Return_3M"]),
        float(row["USD_Return_12M"]),
        float(row["USD_MA_Ratio_12"]),
        float(row["USD_Acceleration"]),
        float(row["Housing_to_USD_Lag_1"]),
        float(row["Housing_to_USD_Lag_3"]),
        float(row["Housing_to_USD_Lag_12"]),
        float(row["Housing_to_USD_ZScore_Lag_1"]),
        float(row["Coin_Bubble"]),
        float(row["Iran_GPR"]),
        float(row["Iran_GPR_MA3"]),
        float(row["M2_Growth_YoY_Lag_3"]),
        float(row["M2_Growth_Acceleration"]),
        float(row["Monetary_Excess"]),
        float(row["Inflation_General_YoY_Lag_3"]),
        float(row["TEDPIX_Return_3M"]),
        float(row["Construction_Cost_Real"]),
        float(row["Month_Sin"]),
        float(row["Month_Cos"]),
    ]


def engineer_micro_features(req, spatial: dict, region_id: int, neighborhood_encoded: float) -> list:
    floor_elevator_penalty    = req.floor_num * (1 - int(req.has_elevator))
    bonus_tod_livability      = max(0.0, 1.0 - spatial["dist_to_metro"] / 1500.0)
    penalty_traffic_nuisance  = float(spatial["traffic_zone_status"])
    suburban_flag             = 1.0 if spatial["dist_to_cbd"] > 12000 else 0.0
    suburban_metro_dependency = (spatial["dist_to_metro"] / 1000.0) * suburban_flag
    highway_sweetspot         = 1 if 200 <= spatial["dist_to_highway"] <= 900 else 0

    return [
        int(req.has_elevator),
        int(req.has_parking),
        0,                             # is_price_converted
        int(req.is_villa),
        float(req.area),               # land_size
        float(req.area),               # building_size
        float(req.rooms_count),
        float(req.building_age),
        float(req.lat),                # location_latitude
        float(req.lon),                # location_longitude
        0.0,                           # location_radius
        float(spatial["commercial_density"]),
        float(spatial["dist_to_metro"]),
        float(spatial["dist_to_cbd"]),
        float(spatial["dist_to_highway"]),
        float(spatial["seismic_risk_level"]),
        float(spatial["air_quality_aqi"]),
        float(spatial["traffic_zone_status"]),
        float(spatial["urban_decay_class"]),
        float(floor_elevator_penalty),
        float(bonus_tod_livability),
        float(penalty_traffic_nuisance),
        float(suburban_metro_dependency),
        float(highway_sweetspot),
        float(region_id),
        float(req.floor_num),
        float(req.total_floors),       # total_floors_num
        float(req.unit_per_floor),     # unit_per_floor_num
        float(neighborhood_encoded),
    ]


def scrape_live_usd() -> Optional[float]:
    """Fetch live USD/Toman rate from BrsApi."""
    try:
        import subprocess
        cmd = 'curl -s "https://Api.BrsApi.ir/Market/Gold_Currency.php?key=B8rWPPXwLqJFRKbKv347ynyP8ahduHWy"'
        output = subprocess.check_output(cmd, shell=True, text=True, timeout=8)
        data = json.loads(output)
        for curr in data.get("currency", []):
            if curr.get("symbol") == "USD":
                return float(curr.get("price", 0))
    except Exception as e:
        print(f"[scrape] USD failed: {e}")
    return None


def get_bq_client():
    from google.cloud import bigquery
    return bigquery.Client(project="siavak-temp-aliz")


# ─── MODEL CACHE (background-threaded load) ──────────────────────────────────────
_cache: dict = {}
_loading_error: Optional[str] = None


def _load_xgb_model(filename: str) -> xgb.Booster:
    booster = xgb.Booster()
    gz_path = os.path.join(MODELS_DIR, filename + ".gz")
    json_path = os.path.join(MODELS_DIR, filename)

    # Check for split parts (e.g. micro_model_v2.part_aa, part_ab, ...)
    stem = filename.replace(".json", "")
    parts = sorted([f for f in os.listdir(MODELS_DIR) if f.startswith(f"{stem}.part_")])

    if parts:
        print(f"[loader] Recombining {len(parts)} split parts for {filename}...")
        compressed_data = b"".join(
            open(os.path.join(MODELS_DIR, p), "rb").read() for p in parts
        )
        import gzip
        decompressed_data = gzip.decompress(compressed_data)
        try:
            booster.load_model(bytearray(decompressed_data))
        except Exception:
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
                tmp.write(decompressed_data)
                tmp_path = tmp.name
            booster.load_model(tmp_path)
            try:
                os.remove(tmp_path)
            except Exception:
                pass
    elif os.path.exists(gz_path):
        import gzip
        with gzip.open(gz_path, "rb") as f:
            decompressed_data = f.read()
        try:
            booster.load_model(bytearray(decompressed_data))
        except Exception:
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
                tmp.write(decompressed_data)
                tmp_path = tmp.name
            booster.load_model(tmp_path)
            try:
                os.remove(tmp_path)
            except Exception:
                pass
    elif os.path.exists(json_path):
        booster.load_model(json_path)
    else:
        raise FileNotFoundError(f"No valid model file or parts found for {filename}.")
    return booster


def _load_json_dict(filename: str) -> dict:
    gz_path = os.path.join(MODELS_DIR, filename + ".gz")
    json_path = os.path.join(MODELS_DIR, filename)
    if os.path.exists(gz_path):
        import gzip
        with gzip.open(gz_path, "rt", encoding="utf-8") as f:
            return json.load(f)
    elif os.path.exists(json_path):
        with open(json_path, encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError(f"Neither {gz_path} nor {json_path} found.")


def _load_models_sync() -> None:
    """Load all 5 V2 models in a background thread.
    Supports .json, .json.gz, and split .part_ formats.
    """
    global _loading_error
    print("[startup] Background thread: loading V2 models...")
    try:
        macro = _load_xgb_model("macro_model_v2.json")
        print("[startup] macro_model_v2 ✓")

        macro_q05 = _load_xgb_model("macro_q05_v2.json")
        print("[startup] macro_q05_v2 ✓")

        macro_q95 = _load_xgb_model("macro_q95_v2.json")
        print("[startup] macro_q95_v2 ✓")

        micro = _load_xgb_model("micro_model_v2.json")
        print("[startup] micro_model_v2 ✓")

        enc = _load_json_dict("neighborhood_encoding_v2.json")
        print("[startup] neighborhood_encoding_v2 ✓")

        _cache["macro"]     = macro
        _cache["macro_q05"] = macro_q05
        _cache["macro_q95"] = macro_q95
        _cache["micro"]     = micro
        _cache["encoding"]  = enc
        print("[startup] ✅ All V2 models ready — predictions enabled.")
    except Exception as e:
        _loading_error = str(e)
        print(f"[startup] ❌ Model loading failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kick off model loading in a daemon background thread immediately.
    # Uvicorn starts accepting requests (and health checks) right away.
    t = threading.Thread(target=_load_models_sync, daemon=True)
    t.start()
    print("[startup] Server is up. Models loading in background thread...")
    yield
    _cache.clear()
    print("[shutdown] Models cleared.")


# ─── APP ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Tehran Real Estate Price Predictor API V2",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── SCHEMAS ────────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    lat: float = Field(..., ge=35.5, le=35.9)
    lon: float = Field(..., ge=51.1, le=51.8)
    area: float = Field(..., gt=10, le=5000)
    building_age: int = Field(default=10, ge=0, le=100)
    total_floors: int = Field(default=6, ge=1, le=60)
    floor_num: int = Field(default=2, ge=0, le=60)
    unit_per_floor: int = Field(default=2, ge=1, le=20)
    rooms_count: int = Field(default=2, ge=1, le=20)
    has_elevator: bool = True
    has_parking: bool = True
    is_villa: bool = False
    selected_neighborhood_slug: Optional[str] = None


class SpatialFeatures(BaseModel):
    dist_to_metro_m: float
    dist_to_cbd_m: float
    dist_to_highway_m: float
    commercial_density: int
    seismic_risk_level: int
    air_quality_aqi: float
    traffic_zone_status: int
    urban_decay_class: int


class CandidateNeighborhood(BaseModel):
    slug: str
    region_id: int
    distance_km: float
    name: str


class MarketPulse(BaseModel):
    usd_toman: float
    region_avg_price_sqm: float
    inflation_yoy: float
    gpr_index: float
    gpr_ma3: float
    month_jalali: int
    year_jalali: int


class PredictResponse(BaseModel):
    base_price_per_sqm: float
    base_price_low: float
    base_price_high: float
    micro_ratio: float
    final_price_per_sqm: float
    final_total_price: float
    final_total_low: float
    final_total_high: float
    usd_rate: float
    neighborhood: str
    neighborhood_name: str
    region_id: int
    year_jalali: int
    month_jalali: int
    macro_diff: float
    macro_diff_q05: float
    macro_diff_q95: float
    housing_to_usd_lag1: float
    spatial: SpatialFeatures
    candidate_neighborhoods: List[CandidateNeighborhood]
    market_pulse: MarketPulse


# ─── ROUTES ─────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    models_ready = "macro" in _cache and "micro" in _cache
    return {
        "service": "Tehran Real Estate Predictor API V2",
        "version": "2.0.0",
        "status": "running",
        "models_ready": models_ready,
        "loading_error": _loading_error,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    # Always return 200 so Cloud Run health checks pass.
    # Report degraded when models are still loading.
    models_ready = "macro" in _cache and "micro" in _cache
    return {
        "status": "healthy" if models_ready else "loading",
        "models_ready": models_ready,
        "loading_error": _loading_error,
        "macro_loaded":     "macro"     in _cache,
        "macro_q05_loaded": "macro_q05" in _cache,
        "macro_q95_loaded": "macro_q95" in _cache,
        "micro_loaded":     "micro"     in _cache,
        "encoding_entries": len(_cache.get("encoding", {})),
    }


@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(req: PredictRequest):
    if "macro" not in _cache:
        detail = (
            f"Models still loading. Please retry in a moment. "
            f"{'Error: ' + _loading_error if _loading_error else 'Loading in progress...'}"
        )
        raise HTTPException(status_code=503, detail=detail)

    try:
        print(f"[predict] lat={req.lat}, lon={req.lon}, area={req.area}, slug={req.selected_neighborhood_slug}")

        # 1. Live USD
        live_usd_scraped = scrape_live_usd()

        # 2. BigQuery macro row
        bq = get_bq_client()
        macro_row = fetch_latest_macro_row(bq)
        live_usd = live_usd_scraped or float(macro_row["USD_Free_Market"])

        # 3. Neighborhood selection
        candidates  = get_top_candidate_neighborhoods(req.lat, req.lon, top_k=3)
        closest_nb  = candidates[0]

        if req.selected_neighborhood_slug:
            chosen_slug = req.selected_neighborhood_slug
            matched     = next((x for x in NEIGHBORHOODS_DATA if x["slug"] == chosen_slug), None)
            nb_region   = matched["region_id"] if matched else closest_nb["region_id"]
        else:
            chosen_slug = closest_nb["slug"]
            nb_region   = closest_nb["region_id"]

        # 4. Region detection
        bq_region = fetch_region_id_from_borders(bq, req.lat, req.lon)
        region_id = bq_region if bq_region is not None else nb_region

        # 5. Spatial features
        spatial = fetch_spatial_features(bq, req.lat, req.lon)

        # 6. Neighborhood encoding
        enc_dict    = _cache["encoding"]
        global_mean = float(enc_dict.get("GLOBAL_MEAN", 1.0))
        nb_encoded  = float(enc_dict.get(chosen_slug, global_mean))

        # 7. Macro V2 inference — log-differential math
        macro_feat = build_macro_features(macro_row)
        macro_dm   = xgb.DMatrix(np.array([macro_feat], dtype=float), feature_names=MACRO_COLUMNS)

        housing_to_usd_lag1 = float(macro_row["Housing_to_USD_Lag_1"])
        log_anchor          = math.log(housing_to_usd_lag1)

        macro_diff     = float(_cache["macro"].predict(macro_dm)[0])
        macro_diff_q05 = float(_cache["macro_q05"].predict(macro_dm)[0])
        macro_diff_q95 = float(_cache["macro_q95"].predict(macro_dm)[0])

        base_price_per_sqm = math.exp(log_anchor + macro_diff)     * live_usd
        base_price_low     = math.exp(log_anchor + macro_diff_q05) * live_usd
        base_price_high    = math.exp(log_anchor + macro_diff_q95) * live_usd

        # 8. Micro V2 inference
        micro_feat = engineer_micro_features(req, spatial, region_id, nb_encoded)
        micro_dm   = xgb.DMatrix(np.array([micro_feat], dtype=float), feature_names=MICRO_COLUMNS)
        micro_ratio = float(_cache["micro"].predict(micro_dm)[0])

        # 9. Final prices
        final_price_per_sqm = base_price_per_sqm * micro_ratio
        final_total_price   = final_price_per_sqm * req.area
        final_total_low     = base_price_low  * micro_ratio * req.area
        final_total_high    = base_price_high * micro_ratio * req.area

        # 10. Structured log
        print(json.dumps({
            "event": "prediction_v2",
            "lat": req.lat, "lon": req.lon, "area": req.area,
            "region_id": region_id, "neighborhood": chosen_slug,
            "housing_to_usd_lag1": round(housing_to_usd_lag1, 6),
            "live_usd": round(live_usd, 2),
            "macro_diff": round(macro_diff, 6),
            "micro_ratio": round(micro_ratio, 6),
            "final_total_price": round(final_total_price, 2),
        }, ensure_ascii=False))

        # 11. Market Pulse
        inflation_yoy = float(macro_row.get("Inflation_General_YoY_Lag_3", 0.0))
        gpr_index     = float(macro_row.get("Iran_GPR", 0.0))
        gpr_ma3       = float(macro_row.get("Iran_GPR_MA3", 0.0))
        month_jalali  = int(macro_row.get("Month_Jalali", 0))
        year_jalali   = int(macro_row.get("Year_Jalali", 0))
        region_avg    = housing_to_usd_lag1 * live_usd

        return PredictResponse(
            base_price_per_sqm  = round(base_price_per_sqm, 4),
            base_price_low      = round(base_price_low, 4),
            base_price_high     = round(base_price_high, 4),
            micro_ratio         = round(micro_ratio, 6),
            final_price_per_sqm = round(final_price_per_sqm, 4),
            final_total_price   = round(final_total_price, 2),
            final_total_low     = round(final_total_low, 2),
            final_total_high    = round(final_total_high, 2),
            usd_rate            = round(live_usd, 2),
            neighborhood        = chosen_slug,
            neighborhood_name   = chosen_slug.replace("-", " ").title(),
            region_id           = region_id,
            year_jalali         = year_jalali,
            month_jalali        = month_jalali,
            macro_diff          = round(macro_diff, 6),
            macro_diff_q05      = round(macro_diff_q05, 6),
            macro_diff_q95      = round(macro_diff_q95, 6),
            housing_to_usd_lag1 = round(housing_to_usd_lag1, 6),
            spatial             = SpatialFeatures(
                dist_to_metro_m     = round(spatial["dist_to_metro"], 1),
                dist_to_cbd_m       = round(spatial["dist_to_cbd"], 1),
                dist_to_highway_m   = round(spatial["dist_to_highway"], 1),
                commercial_density  = spatial["commercial_density"],
                seismic_risk_level  = spatial["seismic_risk_level"],
                air_quality_aqi     = spatial["air_quality_aqi"],
                traffic_zone_status = spatial["traffic_zone_status"],
                urban_decay_class   = spatial["urban_decay_class"],
            ),
            candidate_neighborhoods = [CandidateNeighborhood(**c) for c in candidates],
            market_pulse = MarketPulse(
                usd_toman            = round(live_usd, 2),
                region_avg_price_sqm = round(region_avg, 2),
                inflation_yoy        = round(inflation_yoy * 100, 1),
                gpr_index            = round(gpr_index, 1),
                gpr_ma3              = round(gpr_ma3, 1),
                month_jalali         = month_jalali,
                year_jalali          = year_jalali,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR]\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
