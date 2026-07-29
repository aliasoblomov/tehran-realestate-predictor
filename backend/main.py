"""
Tehran Real Estate Price Prediction — FastAPI Backend
backend/main.py
"""

import json
import os
import math
import re
import traceback
from contextlib import asynccontextmanager
from typing import Optional, List

import numpy as np
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# CONSTANTS & NEIGHBORHOOD DATA
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

NEIGHBORHOODS_DATA = [
  {
    "slug": "tajrish",
    "region_id": 1,
    "lat": 35.802185,
    "lon": 51.431004
  },
  {
    "slug": "elahiyeh",
    "region_id": 1,
    "lat": 35.790916,
    "lon": 51.426933
  },
  {
    "slug": "zafaraniyeh",
    "region_id": 1,
    "lat": 35.809017,
    "lon": 51.414654
  },
  {
    "slug": "mahmoodiyeh",
    "region_id": 1,
    "lat": 35.795753,
    "lon": 51.412777
  },
  {
    "slug": "velenjak",
    "region_id": 1,
    "lat": 35.805008,
    "lon": 51.40098
  },
  {
    "slug": "evin",
    "region_id": 1,
    "lat": 35.798706,
    "lon": 51.39322
  },
  {
    "slug": "darakeh",
    "region_id": 1,
    "lat": 35.806396,
    "lon": 51.38392
  },
  {
    "slug": "aghdasieh",
    "region_id": 1,
    "lat": 35.804657,
    "lon": 51.476944
  },
  {
    "slug": "ajoodanieh",
    "region_id": 1,
    "lat": 35.806793,
    "lon": 51.48422
  },
  {
    "slug": "darabad",
    "region_id": 1,
    "lat": 35.81159,
    "lon": 51.49072
  },
  {
    "slug": "niavaran",
    "region_id": 1,
    "lat": 35.817665,
    "lon": 51.469242
  },
  {
    "slug": "jamaran",
    "region_id": 1,
    "lat": 35.81823,
    "lon": 51.45895
  },
  {
    "slug": "hesar-booali",
    "region_id": 1,
    "lat": 35.805046,
    "lon": 51.468655
  },
  {
    "slug": "chizar",
    "region_id": 1,
    "lat": 35.798313,
    "lon": 51.455593
  },
  {
    "slug": "qeytariyeh",
    "region_id": 1,
    "lat": 35.790344,
    "lon": 51.44359
  },
  {
    "slug": "bagh-ferdows",
    "region_id": 1,
    "lat": 35.803352,
    "lon": 51.424007
  },
  {
    "slug": "golab-dareh",
    "region_id": 1,
    "lat": 35.819225,
    "lon": 51.439796
  },
  {
    "slug": "emamzade-ghasem",
    "region_id": 1,
    "lat": 35.812515,
    "lon": 51.440018
  },
  {
    "slug": "hekmat",
    "region_id": 1,
    "lat": 35.800762,
    "lon": 51.442806
  },
  {
    "slug": "shahrak-e-mahalati",
    "region_id": 1,
    "lat": 35.80488,
    "lon": 51.519085
  },
  {
    "slug": "sohanak",
    "region_id": 1,
    "lat": 35.800293,
    "lon": 51.53019
  },
  {
    "slug": "kashanak",
    "region_id": 1,
    "lat": 35.81564,
    "lon": 51.479343
  },
  {
    "slug": "kamraniyeh",
    "region_id": 1,
    "lat": 35.806644,
    "lon": 51.46268
  },
  {
    "slug": "farmaniyeh",
    "region_id": 1,
    "lat": 35.79588,
    "lon": 51.471874
  },
  {
    "slug": "dezashib",
    "region_id": 1,
    "lat": 35.808712,
    "lon": 51.4531
  },
  {
    "slug": "araj",
    "region_id": 1,
    "lat": 35.794216,
    "lon": 51.48749
  },
  {
    "slug": "kuy-nobonyad",
    "region_id": 1,
    "lat": 35.78313,
    "lon": 51.486397
  },
  {
    "slug": "shahrak-naft",
    "region_id": 1,
    "lat": 35.809345,
    "lon": 51.505573
  },
  {
    "slug": "darband",
    "region_id": 1,
    "lat": 35.81608,
    "lon": 51.427116
  },
  {
    "slug": "saadat-abad",
    "region_id": 2,
    "lat": 35.781883,
    "lon": 51.3749
  },
  {
    "slug": "eivanak",
    "region_id": 2,
    "lat": 35.756733,
    "lon": 51.35456
  },
  {
    "slug": "kuy-faraz",
    "region_id": 2,
    "lat": 35.796703,
    "lon": 51.371002
  },
  {
    "slug": "aseman",
    "region_id": 2,
    "lat": 35.778248,
    "lon": 51.35162
  },
  {
    "slug": "sepehr",
    "region_id": 2,
    "lat": 35.768726,
    "lon": 51.353603
  },
  {
    "slug": "darya",
    "region_id": 2,
    "lat": 35.771034,
    "lon": 51.37821
  },
  {
    "slug": "sharara",
    "region_id": 2,
    "lat": 35.71979,
    "lon": 51.37151
  },
  {
    "slug": "marzdaran",
    "region_id": 2,
    "lat": 35.739033,
    "lon": 51.34062
  },
  {
    "slug": "shahrak-e-jandarmeri",
    "region_id": 2,
    "lat": 35.739113,
    "lon": 51.358753
  },
  {
    "slug": "gisha",
    "region_id": 2,
    "lat": 35.738556,
    "lon": 51.37743
  },
  {
    "slug": "tehranvila",
    "region_id": 2,
    "lat": 35.7226,
    "lon": 51.366577
  },
  {
    "slug": "daryan-no",
    "region_id": 2,
    "lat": 35.713863,
    "lon": 51.35906
  },
  {
    "slug": "sattarkhan",
    "region_id": 2,
    "lat": 35.723278,
    "lon": 51.356926
  },
  {
    "slug": "tarasht",
    "region_id": 2,
    "lat": 35.706665,
    "lon": 51.34296
  },
  {
    "slug": "farahzad",
    "region_id": 2,
    "lat": 35.789047,
    "lon": 51.34448
  },
  {
    "slug": "shahrak-e-koohsar",
    "region_id": 2,
    "lat": 35.781746,
    "lon": 51.33294
  },
  {
    "slug": "parvaz",
    "region_id": 2,
    "lat": 35.789352,
    "lon": 51.3541
  },
  {
    "slug": "sharif",
    "region_id": 2,
    "lat": 35.74972,
    "lon": 51.132893
  },
  {
    "slug": "university-of-sharif",
    "region_id": 2,
    "lat": 35.705585,
    "lon": 51.35292
  },
  {
    "slug": "shadman",
    "region_id": 2,
    "lat": 35.70762,
    "lon": 51.36435
  },
  {
    "slug": "tohid",
    "region_id": 2,
    "lat": 35.70471,
    "lon": 51.372128
  },
  {
    "slug": "baqerkhan",
    "region_id": 2,
    "lat": 35.716763,
    "lon": 51.37618
  },
  {
    "slug": "vanak",
    "region_id": 3,
    "lat": 35.756386,
    "lon": 51.39823
  },
  {
    "slug": "amaniyeh",
    "region_id": 3,
    "lat": 35.778667,
    "lon": 51.419865
  },
  {
    "slug": "jordan",
    "region_id": 3,
    "lat": 35.765583,
    "lon": 51.412327
  },
  {
    "slug": "gandi",
    "region_id": 3,
    "lat": 35.749237,
    "lon": 51.416668
  },
  {
    "slug": "tavanir",
    "region_id": 3,
    "lat": 35.745815,
    "lon": 51.408955
  },
  {
    "slug": "darb-dowom",
    "region_id": 3,
    "lat": 35.781128,
    "lon": 51.441833
  },
  {
    "slug": "zargandeh",
    "region_id": 3,
    "lat": 35.776695,
    "lon": 51.432632
  },
  {
    "slug": "qoba",
    "region_id": 3,
    "lat": 35.76101,
    "lon": 51.44923
  },
  {
    "slug": "ekhtiyariyeh",
    "region_id": 3,
    "lat": 35.786255,
    "lon": 51.460365
  },
  {
    "slug": "darrous",
    "region_id": 3,
    "lat": 35.773624,
    "lon": 51.456184
  },
  {
    "slug": "pasdaran",
    "region_id": 3,
    "lat": 35.772717,
    "lon": 51.468
  },
  {
    "slug": "seyed-khandan",
    "region_id": 3,
    "lat": 35.748585,
    "lon": 51.456993
  },
  {
    "slug": "ararat",
    "region_id": 3,
    "lat": 35.78125,
    "lon": 51.40314
  },
  {
    "slug": "vanak-village",
    "region_id": 3,
    "lat": 35.768135,
    "lon": 51.39199
  },
  {
    "slug": "tehran-jolfa",
    "region_id": 3,
    "lat": 35.74684,
    "lon": 51.436592
  },
  {
    "slug": "gholhak",
    "region_id": 3,
    "lat": 35.773624,
    "lon": 51.444397
  },
  {
    "slug": "zafar",
    "region_id": 3,
    "lat": 35.76571,
    "lon": 51.4332
  },
  {
    "slug": "east-tehranpars",
    "region_id": 4,
    "lat": 35.74096,
    "lon": 51.547
  },
  {
    "slug": "west-tehranpars",
    "region_id": 4,
    "lat": 35.735928,
    "lon": 51.527725
  },
  {
    "slug": "hakimiyeh",
    "region_id": 4,
    "lat": 35.73933,
    "lon": 51.587807
  },
  {
    "slug": "majid-abad",
    "region_id": 4,
    "lat": 35.761524,
    "lon": 51.544888
  },
  {
    "slug": "qasemabad",
    "region_id": 4,
    "lat": 35.707375,
    "lon": 51.473232
  },
  {
    "slug": "shams-abad",
    "region_id": 4,
    "lat": 35.748993,
    "lon": 51.478504
  },
  {
    "slug": "shemiran-no",
    "region_id": 4,
    "lat": 35.750946,
    "lon": 51.49504
  },
  {
    "slug": "lavizan",
    "region_id": 4,
    "lat": 35.77224,
    "lon": 51.51327
  },
  {
    "slug": "shian",
    "region_id": 4,
    "lat": 35.76552,
    "lon": 51.50049
  },
  {
    "slug": "khak-sefid",
    "region_id": 4,
    "lat": 35.742546,
    "lon": 51.56312
  },
  {
    "slug": "oghaf",
    "region_id": 4,
    "lat": 35.749607,
    "lon": 51.51452
  },
  {
    "slug": "ghanat-kosar",
    "region_id": 4,
    "lat": 35.75571,
    "lon": 51.5296
  },
  {
    "slug": "shahrak-e-omid",
    "region_id": 4,
    "lat": 35.7664,
    "lon": 51.53567
  },
  {
    "slug": "javadiyeh-tehran-pars",
    "region_id": 4,
    "lat": 35.732334,
    "lon": 51.549267
  },
  {
    "slug": "etehad",
    "region_id": 4,
    "lat": 35.73039,
    "lon": 51.56837
  },
  {
    "slug": "tehran-hosein-abad",
    "region_id": 4,
    "lat": 35.77451,
    "lon": 51.481434
  },
  {
    "slug": "heravi",
    "region_id": 4,
    "lat": 35.76387,
    "lon": 51.474365
  },
  {
    "slug": "hezarsang",
    "region_id": 4,
    "lat": 35.753,
    "lon": 51.758
  },
  {
    "slug": "mobarak-abad-e-beheshti",
    "region_id": 4,
    "lat": 35.753,
    "lon": 51.488
  },
  {
    "slug": "kazem-abad",
    "region_id": 4,
    "lat": 35.750256,
    "lon": 51.469078
  },
  {
    "slug": "shahrak-golha",
    "region_id": 4,
    "lat": 35.803802,
    "lon": 51.497787
  },
  {
    "slug": "poonak",
    "region_id": 5,
    "lat": 35.762077,
    "lon": 51.331444
  },
  {
    "slug": "shahin",
    "region_id": 5,
    "lat": 35.761795,
    "lon": 51.31473
  },
  {
    "slug": "bagh-feyz",
    "region_id": 5,
    "lat": 35.744724,
    "lon": 51.322525
  },
  {
    "slug": "sadeghiyeh",
    "region_id": 5,
    "lat": 35.719387,
    "lon": 51.342903
  },
  {
    "slug": "sazamn-barnameh",
    "region_id": 5,
    "lat": 35.731377,
    "lon": 51.300472
  },
  {
    "slug": "eram",
    "region_id": 5,
    "lat": 35.729046,
    "lon": 51.28668
  },
  {
    "slug": "ekbatan",
    "region_id": 5,
    "lat": 35.70816,
    "lon": 51.304195
  },
  {
    "slug": "kooy-e-bimeh",
    "region_id": 5,
    "lat": 35.705322,
    "lon": 51.318638
  },
  {
    "slug": "shahrak-e-apadana",
    "region_id": 5,
    "lat": 35.70683,
    "lon": 51.328655
  },
  {
    "slug": "shahr-e-ziba",
    "region_id": 5,
    "lat": 35.748688,
    "lon": 51.291924
  },
  {
    "slug": "south-shahran",
    "region_id": 5,
    "lat": 35.758667,
    "lon": 51.290768
  },
  {
    "slug": "north-shahran",
    "region_id": 5,
    "lat": 35.768,
    "lon": 51.282
  },
  {
    "slug": "central-janat-abad",
    "region_id": 5,
    "lat": 35.75906,
    "lon": 51.303818
  },
  {
    "slug": "north-janat-abad",
    "region_id": 5,
    "lat": 35.77209,
    "lon": 51.30841
  },
  {
    "slug": "south-janat-abad",
    "region_id": 5,
    "lat": 35.745792,
    "lon": 51.305984
  },
  {
    "slug": "kan",
    "region_id": 5,
    "lat": 35.758373,
    "lon": 51.278584
  },
  {
    "slug": "morad-abad",
    "region_id": 5,
    "lat": 35.78469,
    "lon": 51.32637
  },
  {
    "slug": "almahdi",
    "region_id": 5,
    "lat": 35.774055,
    "lon": 51.328354
  },
  {
    "slug": "kooy-e-ferdos",
    "region_id": 5,
    "lat": 35.720898,
    "lon": 51.321365
  },
  {
    "slug": "andisheh",
    "region_id": 5,
    "lat": 35.747078,
    "lon": 51.277683
  },
  {
    "slug": "shahrak-e-parvaz",
    "region_id": 5,
    "lat": 35.724777,
    "lon": 51.30628
  },
  {
    "slug": "shahrak-naft-district5",
    "region_id": 5,
    "lat": 35.783,
    "lon": 51.311
  },
  {
    "slug": "sazman-ab",
    "region_id": 5,
    "lat": 35.73956,
    "lon": 51.289955
  },
  {
    "slug": "tehran-hesarak",
    "region_id": 5,
    "lat": 35.78346,
    "lon": 51.312172
  },
  {
    "slug": "amir-abad",
    "region_id": 6,
    "lat": 35.735477,
    "lon": 51.390358
  },
  {
    "slug": "yousef-abad",
    "region_id": 6,
    "lat": 35.73621,
    "lon": 51.40563
  },
  {
    "slug": "nosrat",
    "region_id": 6,
    "lat": 35.706745,
    "lon": 51.38434
  },
  {
    "slug": "bolvar-e-keshavarz",
    "region_id": 6,
    "lat": 35.71367,
    "lon": 51.399075
  },
  {
    "slug": "tehran-university",
    "region_id": 6,
    "lat": 35.705254,
    "lon": 51.39762
  },
  {
    "slug": "enqelab",
    "region_id": 6,
    "lat": 35.69842,
    "lon": 51.402332
  },
  {
    "slug": "jahad",
    "region_id": 6,
    "lat": 35.72464,
    "lon": 51.403404
  },
  {
    "slug": "behjat-abad",
    "region_id": 6,
    "lat": 35.71929,
    "lon": 51.412136
  },
  {
    "slug": "iranshahr",
    "region_id": 6,
    "lat": 35.708656,
    "lon": 51.42204
  },
  {
    "slug": "qezel-qaleh",
    "region_id": 6,
    "lat": 35.728806,
    "lon": 51.393524
  },
  {
    "slug": "shahrak-valfajr",
    "region_id": 6,
    "lat": 35.746147,
    "lon": 51.39053
  },
  {
    "slug": "jamalzadeh",
    "region_id": 6,
    "lat": 35.697315,
    "lon": 51.388508
  },
  {
    "slug": "north-karegar",
    "region_id": 6,
    "lat": 35.71895,
    "lon": 51.38887
  },
  {
    "slug": "arjantin",
    "region_id": 6,
    "lat": 35.73532,
    "lon": 51.415684
  },
  {
    "slug": "motahari",
    "region_id": 6,
    "lat": 35.72147,
    "lon": 51.420944
  },
  {
    "slug": "nejatollahi",
    "region_id": 6,
    "lat": 35.708202,
    "lon": 51.415264
  },
  {
    "slug": "valiasr",
    "region_id": 6,
    "lat": 35.706383,
    "lon": 51.408028
  },
  {
    "slug": "niloufar",
    "region_id": 7,
    "lat": 35.73617,
    "lon": 51.43405
  },
  {
    "slug": "bahar",
    "region_id": 7,
    "lat": 35.71066,
    "lon": 51.43321
  },
  {
    "slug": "heshamatiyeh",
    "region_id": 7,
    "lat": 35.72613,
    "lon": 51.449997
  },
  {
    "slug": "khaje-nezam-molk",
    "region_id": 7,
    "lat": 35.71325,
    "lon": 51.447914
  },
  {
    "slug": "tehran-gorgan",
    "region_id": 7,
    "lat": 35.709583,
    "lon": 51.450798
  },
  {
    "slug": "east-shareq",
    "region_id": 7,
    "lat": 35.711483,
    "lon": 51.4654
  },
  {
    "slug": "dabestan",
    "region_id": 7,
    "lat": 35.73596,
    "lon": 51.45444
  },
  {
    "slug": "nezam-abad",
    "region_id": 7,
    "lat": 35.707832,
    "lon": 51.455956
  },
  {
    "slug": "abbas-abad",
    "region_id": 7,
    "lat": 35.72766,
    "lon": 51.434525
  },
  {
    "slug": "emam-hossein",
    "region_id": 7,
    "lat": 35.701984,
    "lon": 51.447834
  },
  {
    "slug": "north-sohrevardi",
    "region_id": 7,
    "lat": 35.7209,
    "lon": 51.43482
  },
  {
    "slug": "tehran-khaghani",
    "region_id": 7,
    "lat": 35.711193,
    "lon": 51.428223
  },
  {
    "slug": "eshrat-abad",
    "region_id": 7,
    "lat": 35.703915,
    "lon": 51.43778
  },
  {
    "slug": "tehran-police",
    "region_id": 7,
    "lat": 35.713795,
    "lon": 51.441837
  },
  {
    "slug": "narmak",
    "region_id": 8,
    "lat": 35.72764,
    "lon": 51.49703
  },
  {
    "slug": "sarsabz",
    "region_id": 8,
    "lat": 35.72764,
    "lon": 51.49703
  },
  {
    "slug": "haft-hoz",
    "region_id": 8,
    "lat": 35.728413,
    "lon": 51.489872
  },
  {
    "slug": "dardasht",
    "region_id": 8,
    "lat": 35.72881,
    "lon": 51.506668
  },
  {
    "slug": "fadak",
    "region_id": 8,
    "lat": 35.72777,
    "lon": 51.481144
  },
  {
    "slug": "zarkesh",
    "region_id": 8,
    "lat": 35.7161,
    "lon": 51.480354
  },
  {
    "slug": "taslihat",
    "region_id": 8,
    "lat": 35.71927,
    "lon": 51.47311
  },
  {
    "slug": "tehran-kerman",
    "region_id": 8,
    "lat": 35.732655,
    "lon": 51.47384
  },
  {
    "slug": "vahidiyeh",
    "region_id": 8,
    "lat": 35.71442,
    "lon": 51.47088
  },
  {
    "slug": "majidiyeh",
    "region_id": 8,
    "lat": 35.735565,
    "lon": 51.466454
  },
  {
    "slug": "sabalan",
    "region_id": 8,
    "lat": 35.724483,
    "lon": 51.463333
  },
  {
    "slug": "tehran-lashkar",
    "region_id": 8,
    "lat": 35.72747,
    "lon": 51.4657
  },
  {
    "slug": "south-narmak",
    "region_id": 8,
    "lat": 35.717785,
    "lon": 51.490887
  },
  {
    "slug": "dr-hoshyar",
    "region_id": 9,
    "lat": 35.694195,
    "lon": 51.35093
  },
  {
    "slug": "shahid-dastgheyb",
    "region_id": 9,
    "lat": 35.686527,
    "lon": 51.348297
  },
  {
    "slug": "shamshiri",
    "region_id": 9,
    "lat": 35.6705,
    "lon": 51.34245
  },
  {
    "slug": "sar-asiyab-mehr-abad",
    "region_id": 9,
    "lat": 35.671803,
    "lon": 51.329636
  },
  {
    "slug": "south-mehrabad",
    "region_id": 9,
    "lat": 35.676933,
    "lon": 51.33802
  },
  {
    "slug": "mehrabad-airport",
    "region_id": 9,
    "lat": 35.68934,
    "lon": 51.302444
  },
  {
    "slug": "fath",
    "region_id": 9,
    "lat": 35.677116,
    "lon": 51.300945
  },
  {
    "slug": "jey",
    "region_id": 9,
    "lat": 35.67895,
    "lon": 51.34921
  },
  {
    "slug": "soleymani",
    "region_id": 10,
    "lat": 35.672226,
    "lon": 51.36379
  },
  {
    "slug": "sarsabil",
    "region_id": 10,
    "lat": 35.690144,
    "lon": 51.37454
  },
  {
    "slug": "beryanak",
    "region_id": 10,
    "lat": 35.674942,
    "lon": 51.377117
  },
  {
    "slug": "haftchenar",
    "region_id": 10,
    "lat": 35.676014,
    "lon": 51.37015
  },
  {
    "slug": "jeyhoun",
    "region_id": 10,
    "lat": 35.69009,
    "lon": 51.366905
  },
  {
    "slug": "azarbaijan",
    "region_id": 10,
    "lat": 35.69893,
    "lon": 51.371666
  },
  {
    "slug": "hasan-abad-shomali",
    "region_id": 10,
    "lat": 35.73258,
    "lon": 51.320435
  },
  {
    "slug": "shabiri",
    "region_id": 10,
    "lat": 35.675198,
    "lon": 51.356686
  },
  {
    "slug": "tous",
    "region_id": 10,
    "lat": 35.66058,
    "lon": 51.35859
  },
  {
    "slug": "tehran-zanjan",
    "region_id": 10,
    "lat": 35.694675,
    "lon": 51.35949
  },
  {
    "slug": "shahid-navab-safavi",
    "region_id": 10,
    "lat": 35.67862,
    "lon": 51.380466
  },
  {
    "slug": "karoon",
    "region_id": 10,
    "lat": 35.691,
    "lon": 51.369
  },
  {
    "slug": "moniriyeh",
    "region_id": 11,
    "lat": 35.684074,
    "lon": 51.40128
  },
  {
    "slug": "amiriyeh",
    "region_id": 11,
    "lat": 35.678253,
    "lon": 51.400852
  },
  {
    "slug": "sheykh-hadi",
    "region_id": 11,
    "lat": 35.69147,
    "lon": 51.401955
  },
  {
    "slug": "hassan-abad",
    "region_id": 11,
    "lat": 35.68538,
    "lon": 51.408707
  },
  {
    "slug": "hor-square",
    "region_id": 11,
    "lat": 35.687157,
    "lon": 51.388138
  },
  {
    "slug": "jomhouri",
    "region_id": 11,
    "lat": 35.697258,
    "lon": 51.381992
  },
  {
    "slug": "makhsous",
    "region_id": 11,
    "lat": 35.678146,
    "lon": 51.389603
  },
  {
    "slug": "amir-bahador",
    "region_id": 11,
    "lat": 35.671116,
    "lon": 51.40357
  },
  {
    "slug": "bolursazi",
    "region_id": 11,
    "lat": 35.66289,
    "lon": 51.37878
  },
  {
    "slug": "qalamestan",
    "region_id": 11,
    "lat": 35.67161,
    "lon": 51.397663
  },
  {
    "slug": "salamat",
    "region_id": 11,
    "lat": 35.67625,
    "lon": 51.383656
  },
  {
    "slug": "eskandari",
    "region_id": 11,
    "lat": 35.688847,
    "lon": 51.381798
  },
  {
    "slug": "gomrok",
    "region_id": 11,
    "lat": 35.665306,
    "lon": 51.392696
  },
  {
    "slug": "shirazi",
    "region_id": 11,
    "lat": 35.746464,
    "lon": 51.39809
  },
  {
    "slug": "ferdowsi",
    "region_id": 12,
    "lat": 35.693672,
    "lon": 51.418297
  },
  {
    "slug": "pamenar",
    "region_id": 12,
    "lat": 35.68142,
    "lon": 51.424812
  },
  {
    "slug": "sirous",
    "region_id": 12,
    "lat": 35.67233,
    "lon": 51.433224
  },
  {
    "slug": "aminhozour",
    "region_id": 12,
    "lat": 35.679424,
    "lon": 51.434395
  },
  {
    "slug": "bazaar",
    "region_id": 12,
    "lat": 35.672733,
    "lon": 51.422565
  },
  {
    "slug": "sanglaj",
    "region_id": 12,
    "lat": 35.67653,
    "lon": 51.41268
  },
  {
    "slug": "baharestan",
    "region_id": 12,
    "lat": 35.69453,
    "lon": 51.429886
  },
  {
    "slug": "tehran-iran",
    "region_id": 12,
    "lat": 35.687664,
    "lon": 51.4398
  },
  {
    "slug": "qiam",
    "region_id": 12,
    "lat": 35.670135,
    "lon": 51.441494
  },
  {
    "slug": "khani-abad",
    "region_id": 12,
    "lat": 35.662865,
    "lon": 51.41033
  },
  {
    "slug": "molavi",
    "region_id": 12,
    "lat": 35.66423,
    "lon": 51.42459
  },
  {
    "slug": "abshar",
    "region_id": 12,
    "lat": 35.678776,
    "lon": 51.44203
  },
  {
    "slug": "darvazeh-shemiran",
    "region_id": 12,
    "lat": 35.696373,
    "lon": 51.442036
  },
  {
    "slug": "malek-abad",
    "region_id": 12,
    "lat": 35.62153,
    "lon": 51.434456
  },
  {
    "slug": "kosar",
    "region_id": 12,
    "lat": 35.663284,
    "lon": 51.438545
  },
  {
    "slug": "shoosh",
    "region_id": 12,
    "lat": 35.652172,
    "lon": 51.440628
  },
  {
    "slug": "pirouzi",
    "region_id": 13,
    "lat": 35.69542,
    "lon": 51.486427
  },
  {
    "slug": "tehran-no",
    "region_id": 13,
    "lat": 35.710094,
    "lon": 51.496353
  },
  {
    "slug": "sorkhe-hesar",
    "region_id": 13,
    "lat": 35.708,
    "lon": 51.564
  },
  {
    "slug": "ashtiyani",
    "region_id": 13,
    "lat": 35.716106,
    "lon": 51.50636
  },
  {
    "slug": "shahed",
    "region_id": 13,
    "lat": 35.673138,
    "lon": 51.47699
  },
  {
    "slug": "dehqan",
    "region_id": 13,
    "lat": 35.695724,
    "lon": 51.47666
  },
  {
    "slug": "tehran-emamat",
    "region_id": 13,
    "lat": 35.710205,
    "lon": 51.489746
  },
  {
    "slug": "shahid-asadi",
    "region_id": 13,
    "lat": 35.701523,
    "lon": 51.455486
  },
  {
    "slug": "farah-abad",
    "region_id": 13,
    "lat": 35.680187,
    "lon": 51.486183
  },
  {
    "slug": "hafezie",
    "region_id": 13,
    "lat": 35.70122,
    "lon": 51.495712
  },
  {
    "slug": "zeynabeiyeh",
    "region_id": 13,
    "lat": 35.707653,
    "lon": 51.507774
  },
  {
    "slug": "qasr-e-firoozeh-yek",
    "region_id": 13,
    "lat": 35.67,
    "lon": 51.5
  },
  {
    "slug": "shokoofeh",
    "region_id": 14,
    "lat": 35.68404,
    "lon": 51.448647
  },
  {
    "slug": "charsad-dastgah",
    "region_id": 14,
    "lat": 35.686466,
    "lon": 51.46149
  },
  {
    "slug": "doolab",
    "region_id": 14,
    "lat": 35.665924,
    "lon": 51.4608
  },
  {
    "slug": "sarasiab-doolab",
    "region_id": 14,
    "lat": 35.67948,
    "lon": 51.460705
  },
  {
    "slug": "ahang",
    "region_id": 14,
    "lat": 35.663185,
    "lon": 51.476677
  },
  {
    "slug": "jaberi",
    "region_id": 14,
    "lat": 35.683502,
    "lon": 51.45217
  },
  {
    "slug": "zahed-gilani",
    "region_id": 14,
    "lat": 35.694157,
    "lon": 51.46017
  },
  {
    "slug": "sheykh-al-raeis",
    "region_id": 14,
    "lat": 35.6945,
    "lon": 51.45207
  },
  {
    "slug": "nabi-akram",
    "region_id": 14,
    "lat": 35.682953,
    "lon": 51.476208
  },
  {
    "slug": "shiva",
    "region_id": 14,
    "lat": 35.68004,
    "lon": 51.46926
  },
  {
    "slug": "soleymanieh",
    "region_id": 14,
    "lat": 35.68102,
    "lon": 51.455246
  },
  {
    "slug": "mina",
    "region_id": 14,
    "lat": 35.672882,
    "lon": 51.45163
  },
  {
    "slug": "aramaneh",
    "region_id": 14,
    "lat": 35.720154,
    "lon": 51.457672
  },
  {
    "slug": "aref",
    "region_id": 14,
    "lat": 35.673824,
    "lon": 51.45875
  },
  {
    "slug": "saheb-al-zaman",
    "region_id": 14,
    "lat": 35.67388,
    "lon": 51.467834
  },
  {
    "slug": "sad-dastgah",
    "region_id": 14,
    "lat": 35.68922,
    "lon": 51.47253
  },
  {
    "slug": "parastar",
    "region_id": 14,
    "lat": 35.688297,
    "lon": 51.485924
  },
  {
    "slug": "taxirani",
    "region_id": 14,
    "lat": 35.671955,
    "lon": 51.487354
  },
  {
    "slug": "afsariyeh",
    "region_id": 15,
    "lat": 35.650806,
    "lon": 51.49224
  },
  {
    "slug": "moshiriyeh",
    "region_id": 15,
    "lat": 35.625053,
    "lon": 51.47763
  },
  {
    "slug": "shahrak-e-kianshahr",
    "region_id": 15,
    "lat": 35.637268,
    "lon": 51.448906
  },
  {
    "slug": "atabak",
    "region_id": 15,
    "lat": 35.64931,
    "lon": 51.46269
  },
  {
    "slug": "minabi",
    "region_id": 15,
    "lat": 35.652096,
    "lon": 51.456764
  },
  {
    "slug": "khavaran",
    "region_id": 15,
    "lat": 35.665424,
    "lon": 51.453148
  },
  {
    "slug": "tayeb",
    "region_id": 15,
    "lat": 35.66023,
    "lon": 51.450222
  },
  {
    "slug": "bisim",
    "region_id": 15,
    "lat": 35.653625,
    "lon": 51.450035
  },
  {
    "slug": "hashem-abad",
    "region_id": 15,
    "lat": 35.64364,
    "lon": 51.471718
  },
  {
    "slug": "qasr-e-firooze-do",
    "region_id": 15,
    "lat": 35.6516,
    "lon": 51.503876
  },
  {
    "slug": "mesgar-abad",
    "region_id": 15,
    "lat": 35.63,
    "lon": 51.52
  },
  {
    "slug": "qiamdash",
    "region_id": 15,
    "lat": 35.541,
    "lon": 51.584
  },
  {
    "slug": "sharifabad",
    "region_id": 15,
    "lat": 35.428,
    "lon": 51.786
  },
  {
    "slug": "shahrak-e-aboozar",
    "region_id": 15,
    "lat": 35.655,
    "lon": 51.47
  },
  {
    "slug": "shahid-borujerdi",
    "region_id": 15,
    "lat": 35.637558,
    "lon": 51.468773
  },
  {
    "slug": "abouzar",
    "region_id": 15,
    "lat": 35.65072,
    "lon": 51.47706
  },
  {
    "slug": "masoudieh",
    "region_id": 15,
    "lat": 35.632595,
    "lon": 51.498425
  },
  {
    "slug": "karevan",
    "region_id": 15,
    "lat": 35.612125,
    "lon": 51.495766
  },
  {
    "slug": "nazi-abad",
    "region_id": 16,
    "lat": 35.64138,
    "lon": 51.405453
  },
  {
    "slug": "yakhchi-abad",
    "region_id": 16,
    "lat": 35.6263,
    "lon": 51.405384
  },
  {
    "slug": "khazaneh",
    "region_id": 16,
    "lat": 35.638935,
    "lon": 51.426044
  },
  {
    "slug": "south-ali-abad",
    "region_id": 16,
    "lat": 35.62682,
    "lon": 51.425335
  },
  {
    "slug": "bahman-yar",
    "region_id": 16,
    "lat": 35.625122,
    "lon": 51.398205
  },
  {
    "slug": "javadiyeh",
    "region_id": 16,
    "lat": 35.64976,
    "lon": 51.39022
  },
  {
    "slug": "shahrak-e-takhti",
    "region_id": 16,
    "lat": 35.625156,
    "lon": 51.415604
  },
  {
    "slug": "baq-e-azari",
    "region_id": 16,
    "lat": 35.65279,
    "lon": 51.423405
  },
  {
    "slug": "fallah",
    "region_id": 17,
    "lat": 35.659267,
    "lon": 51.367393
  },
  {
    "slug": "aboozar",
    "region_id": 17,
    "lat": 35.73085,
    "lon": 51.33056
  },
  {
    "slug": "jalili",
    "region_id": 17,
    "lat": 35.650494,
    "lon": 51.362106
  },
  {
    "slug": "zamzam",
    "region_id": 17,
    "lat": 35.647903,
    "lon": 51.36774
  },
  {
    "slug": "zehtabi",
    "region_id": 17,
    "lat": 35.641743,
    "lon": 51.36014
  },
  {
    "slug": "imamzadeh-hasan",
    "region_id": 17,
    "lat": 35.6654,
    "lon": 51.36076
  },
  {
    "slug": "vasfenard",
    "region_id": 17,
    "lat": 35.646812,
    "lon": 51.35506
  },
  {
    "slug": "baharan",
    "region_id": 17,
    "lat": 35.768887,
    "lon": 51.271564
  },
  {
    "slug": "azari",
    "region_id": 17,
    "lat": 35.666626,
    "lon": 51.350796
  },
  {
    "slug": "tehran-shandiz",
    "region_id": 17,
    "lat": 35.657936,
    "lon": 51.350235
  },
  {
    "slug": "imam-sajjad",
    "region_id": 17,
    "lat": 35.654835,
    "lon": 51.357758
  },
  {
    "slug": "golchin",
    "region_id": 17,
    "lat": 35.653954,
    "lon": 51.36718
  },
  {
    "slug": "bagh-khazaneh",
    "region_id": 17,
    "lat": 35.664024,
    "lon": 51.370758
  },
  {
    "slug": "moqadam",
    "region_id": 17,
    "lat": 35.656246,
    "lon": 51.3745
  },
  {
    "slug": "yaftabad",
    "region_id": 18,
    "lat": 35.642033,
    "lon": 51.301575
  },
  {
    "slug": "shahrak-e-vali-e-asr",
    "region_id": 18,
    "lat": 35.64499,
    "lon": 51.343887
  },
  {
    "slug": "shadabad",
    "region_id": 18,
    "lat": 35.65688,
    "lon": 51.30141
  },
  {
    "slug": "tolid-daroo",
    "region_id": 18,
    "lat": 35.663723,
    "lon": 51.33797
  },
  {
    "slug": "shahrak-e-ferdows",
    "region_id": 18,
    "lat": 35.66301,
    "lon": 51.32534
  },
  {
    "slug": "khalij-e-fars",
    "region_id": 18,
    "lat": 35.688,
    "lon": 51.311
  },
  {
    "slug": "saeed-abad",
    "region_id": 18,
    "lat": 35.59,
    "lon": 51.15
  },
  {
    "slug": "shaharak-e-moslemin",
    "region_id": 18,
    "lat": 35.66,
    "lon": 51.31
  },
  {
    "slug": "kooye-e-hefdahom-e-shahrivar",
    "region_id": 18,
    "lat": 35.669136,
    "lon": 51.294304
  },
  {
    "slug": "ebrahim-abad",
    "region_id": 18,
    "lat": 35.648724,
    "lon": 51.301876
  },
  {
    "slug": "shahrak-e-emamkhomeyni",
    "region_id": 18,
    "lat": 35.662846,
    "lon": 51.314087
  },
  {
    "slug": "behdasht",
    "region_id": 18,
    "lat": 35.657097,
    "lon": 51.337975
  },
  {
    "slug": "khani-abad-no",
    "region_id": 19,
    "lat": 35.625195,
    "lon": 51.39237
  },
  {
    "slug": "abdol-abad",
    "region_id": 19,
    "lat": 35.630436,
    "lon": 51.36584
  },
  {
    "slug": "nemat-abad",
    "region_id": 19,
    "lat": 35.62986,
    "lon": 51.35257
  },
  {
    "slug": "shaharak-e-shariyati",
    "region_id": 19,
    "lat": 35.628,
    "lon": 51.378
  },
  {
    "slug": "dolatkhah",
    "region_id": 19,
    "lat": 35.618443,
    "lon": 51.342953
  },
  {
    "slug": "hasan-abad-baqer-far",
    "region_id": 19,
    "lat": 35.539,
    "lon": 51.405
  },
  {
    "slug": "abdollah-abad",
    "region_id": 19,
    "lat": 35.568,
    "lon": 51.428
  },
  {
    "slug": "shaharak-e-sharifi",
    "region_id": 19,
    "lat": 35.620056,
    "lon": 51.33407
  },
  {
    "slug": "shahrak-e-taleghani",
    "region_id": 20,
    "lat": 35.753,
    "lon": 51.411
  },
  {
    "slug": "karim-abad",
    "region_id": 20,
    "lat": 35.52,
    "lon": 51.465
  },
  {
    "slug": "safaiye",
    "region_id": 20,
    "lat": 35.589,
    "lon": 51.45
  },
  {
    "slug": "sizdah-aban",
    "region_id": 20,
    "lat": 35.597,
    "lon": 51.403
  },
  {
    "slug": "east-saleh-abad",
    "region_id": 20,
    "lat": 35.61,
    "lon": 51.39
  },
  {
    "slug": "south-deylaman",
    "region_id": 20,
    "lat": 35.603333,
    "lon": 51.432556
  },
  {
    "slug": "hamzeh-abad",
    "region_id": 20,
    "lat": 35.597504,
    "lon": 51.42369
  },
  {
    "slug": "shahid-avini",
    "region_id": 20,
    "lat": 35.58475,
    "lon": 51.42752
  },
  {
    "slug": "javanmard-e-ghasab",
    "region_id": 20,
    "lat": 35.613316,
    "lon": 51.425648
  },
  {
    "slug": "firoozabadi",
    "region_id": 20,
    "lat": 35.59539,
    "lon": 51.433235
  },
  {
    "slug": "sartakht",
    "region_id": 20,
    "lat": 35.58938,
    "lon": 51.432182
  },
  {
    "slug": "mansouriyeh",
    "region_id": 20,
    "lat": 35.60918,
    "lon": 51.43764
  },
  {
    "slug": "ebn-babevayh",
    "region_id": 20,
    "lat": 35.602787,
    "lon": 51.441284
  },
  {
    "slug": "shahadat",
    "region_id": 20,
    "lat": 35.613422,
    "lon": 51.44801
  },
  {
    "slug": "dolat-abad",
    "region_id": 20,
    "lat": 35.62114,
    "lon": 51.452793
  },
  {
    "slug": "zahir-abad",
    "region_id": 20,
    "lat": 35.596375,
    "lon": 51.449974
  },
  {
    "slug": "tehransar",
    "region_id": 21,
    "lat": 35.692574,
    "lon": 51.254623
  },
  {
    "slug": "shahrak-e-azadi",
    "region_id": 21,
    "lat": 35.709427,
    "lon": 51.273167
  },
  {
    "slug": "shahrak-e-darya",
    "region_id": 21,
    "lat": 35.685604,
    "lon": 51.238903
  },
  {
    "slug": "shahrak-daneshgah-tehran",
    "region_id": 21,
    "lat": 35.708584,
    "lon": 51.197624
  },
  {
    "slug": "shaharak-e-esteqlal",
    "region_id": 21,
    "lat": 35.70288,
    "lon": 51.22858
  },
  {
    "slug": "shahrak-e-ghazali",
    "region_id": 21,
    "lat": 35.731323,
    "lon": 51.162712
  },
  {
    "slug": "vardavard",
    "region_id": 21,
    "lat": 35.737667,
    "lon": 51.131897
  },
  {
    "slug": "shahrak-e-vilashahr",
    "region_id": 21,
    "lat": 35.726795,
    "lon": 51.17758
  },
  {
    "slug": "shahrak-daneshgahi",
    "region_id": 21,
    "lat": 35.720448,
    "lon": 51.200226
  },
  {
    "slug": "shahrak-pasdaran",
    "region_id": 21,
    "lat": 35.695168,
    "lon": 51.262928
  },
  {
    "slug": "shahrak-farhangian",
    "region_id": 21,
    "lat": 35.7092,
    "lon": 51.285786
  },
  {
    "slug": "chitgar",
    "region_id": 22,
    "lat": 35.718536,
    "lon": 51.162716
  },
  {
    "slug": "chitgar-lake",
    "region_id": 22,
    "lat": 35.738773,
    "lon": 51.206615
  },
  {
    "slug": "abshar-tehran",
    "region_id": 22,
    "lat": 35.760254,
    "lon": 51.224438
  },
  {
    "slug": "west-shahrak-e-golestan",
    "region_id": 22,
    "lat": 35.75313,
    "lon": 51.23481
  },
  {
    "slug": "kuhak",
    "region_id": 22,
    "lat": 35.726765,
    "lon": 51.2347
  },
  {
    "slug": "havanirooz",
    "region_id": 22,
    "lat": 35.740215,
    "lon": 51.24215
  },
  {
    "slug": "dehkade-olympic",
    "region_id": 22,
    "lat": 35.7641,
    "lon": 51.255024
  },
  {
    "slug": "azad-shahr",
    "region_id": 22,
    "lat": 35.746273,
    "lon": 51.175713
  },
  {
    "slug": "shahrak-e-cheshmeh",
    "region_id": 22,
    "lat": 35.75225,
    "lon": 51.261177
  },
  {
    "slug": "azadi-sport-complex",
    "region_id": 22,
    "lat": 35.727753,
    "lon": 51.267174
  }
]

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

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

_cache: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
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
    yield
    _cache.clear()
    print("[shutdown] Models cleared.")

app = FastAPI(
    title="Tehran Real Estate Price Predictor API",
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
    has_warehouse: bool = False
    is_rebuilt: bool = False
    is_villa: bool = False
    selected_neighborhood_slug: Optional[str] = Field(default=None)

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
    candidate_neighborhoods: List[CandidateNeighborhood]

def scrape_live_rates() -> dict:
    result = {"usd": None, "tedpix": None}
    import requests
    from bs4 import BeautifulSoup
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        import subprocess, json
        cmd = 'curl -s "https://Api.BrsApi.ir/Market/Gold_Currency.php?key=B8rWPPXwLqJFRKbKv347ynyP8ahduHWy"'
        output = subprocess.check_output(cmd, shell=True, text=True, timeout=8)
        data = json.loads(output)
        for curr in data.get("currency", []):
            if curr.get("symbol") == "USD":
                result["usd"] = float(curr.get("price", 0))
                break
    except Exception as e:
        print(f"[scrape] USD failed: {e}")

    try:
        tedpix_url = "https://www.tgju.org/profile/tedpix"
        resp = requests.get(tedpix_url, headers=headers, timeout=8)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            tag = soup.find("span", {"data-col": "info_price_rial"})
            if tag and tag.get("data-value"):
                result["tedpix"] = float(tag["data-value"].replace(",", "").strip())
            else:
                for t in soup.select(".market-profile-primary-price strong, .info-price"):
                    text = t.get_text(strip=True).replace(",", "")
                    try:
                        val = float("".join(c for c in text if c.isdigit() or c == "."))
                        if val > 1_000_000:
                            result["tedpix"] = val
                            break
                    except ValueError:
                        continue
    except Exception as e:
        print(f"[scrape] TEDPIX failed: {e}")

    return result

def get_bq_client():
    from google.cloud import bigquery
    return bigquery.Client(project="siavak-temp-aliz")

def _tbl(name: str) -> str:
    return f"`{BQ_DATASET}.{name}`"

def fetch_latest_macro_row(client) -> dict:
    query = f"""
        SELECT *
        FROM {_tbl('macro_monthly_database')}
        ORDER BY Year_Jalali DESC, Month_Jalali DESC
        LIMIT 1
    """
    rows = list(client.query(query).result())
    if not rows:
        raise ValueError("macro_monthly_database returned no rows.")
    return dict(rows[0].items())

def fetch_spatial_features(client, lat: float, lon: float) -> dict:
    strip_z = (
        "REGEXP_REPLACE("
        "REPLACE(REPLACE(geometry_wkt, ' Z', ''), ' ZM', ''), "
        r"r'([0-9eE.\-]+\s+[0-9eE.\-]+)\s+[0-9eE.\-]+(?:\s+[0-9eE.\-]+)?', "
        r"r'')"
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
            SELECT ST_GEOGFROMTEXT({strip_z}) AS geom
            FROM `{BQ_DATASET}.ref_highways`
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
                ST_GEOGFROMTEXT({strip_z}) AS geom,
                SAFE_CAST(traffic_zone_status AS INT64) AS traffic_score
            FROM `{BQ_DATASET}.ref_traffic_zones`
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

MICRO_COLUMNS = [
    "building_area", "building_age", "total_floors_count", "unit_per_floor",
    "rooms_count", "has_elevator", "has_parking", "has_warehouse",
    "is_rebuilt", "is_villa", "dist_to_metro", "dist_to_cbd",
    "dist_to_highway", "commercial_density", "seismic_risk_level",
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

    return [
        req.area, req.building_age, req.total_floors, req.unit_per_floor,
        req.rooms_count, int(req.has_elevator), int(req.has_parking),
        int(req.has_warehouse), int(req.is_rebuilt), int(req.is_villa),
        spatial["dist_to_metro"], spatial["dist_to_cbd"],
        spatial["dist_to_highway"], spatial["commercial_density"],
        spatial["seismic_risk_level"], spatial["air_quality_aqi"],
        spatial["traffic_zone_status"], spatial["urban_decay_class"],
        floor_elevator_penalty, value_retention_bonus, bonus_tod_livability,
        penalty_traffic_nuisance, suburban_metro_dependency, redevelopment_premium,
        highway_sweetspot, region_id, req.floor_num, req.total_floors,
        req.unit_per_floor, neighborhood_encoded,
    ]

def build_macro_features(macro_row, live_usd, live_tedpix, region_id) -> list:
    ohe = [1 if i == region_id else 0 for i in range(1, 23)]
    return [
        int(macro_row["Year_Jalali"]),
        live_usd,
        live_tedpix,
        float(macro_row["USD_Free_Market_Lag_1"]),
        float(macro_row["USD_Free_Market_Lag_3"]),
        float(macro_row["USD_Free_Market_Lag_6"]),
        float(macro_row["TEDPIX_Index_Lag_3"]),
    ] + ohe

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
        "status": "healthy" if ("macro" in _cache and "micro" in _cache) else "degraded",
        "cache": {
            "macro_model_loaded": "macro" in _cache,
            "micro_model_loaded": "micro" in _cache,
            "neighborhood_encoding_entries": len(_cache.get("encoding", {})),
        },
    }

@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(req: PredictRequest):
    if "macro" not in _cache:
        raise HTTPException(status_code=503, detail="Models not loaded...")

    try:
        print(f"[predict] lat={req.lat}, lon={req.lon}, area={req.area}, selected_slug={req.selected_neighborhood_slug}")
        live = scrape_live_rates()

        bq = get_bq_client()
        macro_row = fetch_latest_macro_row(bq)
        live_usd    = live.get("usd")    or float(macro_row["USD_Free_Market"])
        live_tedpix = live.get("tedpix") or float(macro_row["TEDPIX_Index"])

        # C: Top 3 Neighborhood candidates via Python Haversine
        candidates = get_top_candidate_neighborhoods(req.lat, req.lon, top_k=3)
        closest_nb = candidates[0]

        # D: Neighborhood Selection (Manual Override or Auto #1)
        if req.selected_neighborhood_slug:
            chosen_slug = req.selected_neighborhood_slug
            matched = next((item for item in NEIGHBORHOODS_DATA if item["slug"] == chosen_slug), None)
            nb_region = matched["region_id"] if matched else closest_nb["region_id"]
        else:
            chosen_slug = closest_nb["slug"]
            nb_region = closest_nb["region_id"]

        # E: Region Detection via BigQuery ref_tehran_borders polygon -> fallback to nb_region
        bq_region = fetch_region_id_from_borders(bq, req.lat, req.lon)
        region_id = bq_region if bq_region is not None else nb_region

        spatial = fetch_spatial_features(bq, req.lat, req.lon)

        enc_dict = _cache["encoding"]
        global_mean = float(enc_dict.get("GLOBAL_MEAN", 1.0))
        nb_encoded  = float(enc_dict.get(chosen_slug, global_mean))

        macro_feat = build_macro_features(macro_row, live_usd, live_tedpix, region_id)
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

        return PredictResponse(
            base_price_per_sqm  = round(base_price, 2),
            quality_ratio       = round(quality_ratio, 6),
            final_price_per_sqm = round(final_per_sqm, 2),
            final_total_price   = round(final_total, 2),
            usd_rate            = round(live_usd, 2),
            tedpix              = round(live_tedpix, 2),
            neighborhood        = chosen_slug,
            neighborhood_name   = chosen_slug.replace("-", " ").title(),
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
            candidate_neighborhoods = [CandidateNeighborhood(**c) for c in candidates],
        )

    except Exception as e:
        print(f"[ERROR]\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
