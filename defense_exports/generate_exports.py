"""Export the checked-in Tehran models and neighborhood data without network access."""
import ast
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
from struct import pack, unpack
from types import SimpleNamespace

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent
BACKEND = "backend/main.py"
MODELS = "backend/models/"
MICRO = MODELS + "micro_model_v2.json"
MACRO = MODELS + "macro_model_v2.json"
ENC = MODELS + "neighborhood_encoding_v2.json"
TS = "app/utils/neighborhoods.ts"
BOOKS = ["Phase2_Geospatial_Feature_Engineering.ipynb", "phase4_Macro_model.ipynb"]


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2,
                                       allow_nan=False) + "\n", encoding="utf-8")


def backend_features():
    # Extract only the pure feature engineer and its literal configuration.
    scope = {}
    for node in ast.parse((ROOT / BACKEND).read_text()).body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name.startswith("FALLBACK_") or name == "MICRO_FEATURE_NAMES":
                scope[name] = ast.literal_eval(node.value)
        if isinstance(node, ast.FunctionDef) and node.name == "engineer_micro_features_dict":
            exec(compile(ast.Module([node], []), BACKEND, "exec"), scope)
    return scope


def predict(model, rows):
    names = model["feature_names"]
    if importlib.util.find_spec("xgboost"):
        import xgboost as xgb
        booster = xgb.Booster()
        booster.load_model(ROOT / MICRO)
        matrix = xgb.DMatrix(rows, feature_names=names)
        return booster.predict(matrix).tolist()

    # Scalar numerical gbtree, identity link; XGBoost accumulates in float32.
    assert model["objective"]["name"] == "reg:squarederror"
    assert model["gradient_booster"]["name"] == "gbtree"
    def f32(x):
        return unpack("f", pack("f", x))[0]

    trees = model["gradient_booster"]["model"]["trees"]
    base = float(model["learner_model_param"]["base_score"].strip("[]"))
    result = []
    for row in rows:
        value = f32(base)
        for tree in trees:
            node = 0
            while tree["left_children"][node] != -1:
                assert tree["split_type"][node] == 0
                feature = tree["split_indices"][node]
                left = f32(row[feature]) < f32(tree["split_conditions"][node])
                node = tree["left_children" if left else "right_children"][node]
            value = f32(value + f32(tree["split_conditions"][node]))
        result.append(value)
    return result


def importance(model):
    features = [{"feature": name, "split_count": 0} for name in model["feature_names"]]
    for tree in model["gradient_booster"]["model"]["trees"]:
        for child, index in zip(tree["left_children"], tree["split_indices"], strict=True):
            if child != -1:
                features[index]["split_count"] += 1
    return features


def main():
    micro = load(MICRO)["learner"]
    macro = load(MACRO)["learner"]
    encoding = load(ENC)
    ts = (ROOT / TS).read_text()
    labels = dict(re.findall(r'^  "([^"]+)": "([^"]+)"', ts, re.M))
    locations = [json.loads(x) for x in re.findall(r'\{"slug":[^{}]+\}', ts)]
    district = {}
    for location in locations:
        if location["region_id"] == 2:
            slug = location["slug"]
            if district.setdefault(slug, location) != location:
                raise ValueError(f"Conflicting District 2 coordinates for {slug}")
    selected = sorted(district.values(), key=lambda p: (encoding[p["slug"]], p["slug"]))
    fixed = dict(area_sqm=100, age_years=10, rooms=2, floor=4, total_floors=5,
                 has_elevator=True, has_parking=True, has_warehouse=True,
                 is_rebuilt=False, district_id=2)
    scope = backend_features()
    names = micro["feature_names"]
    assert names == scope["MICRO_FEATURE_NAMES"]
    points, rows = [], []
    for i, p in enumerate(selected, 1):
        slug = p["slug"]
        req = SimpleNamespace(area=fixed["area_sqm"], building_age=fixed["age_years"],
                              rooms_count=fixed["rooms"], floor_num=fixed["floor"],
                              total_floors=fixed["total_floors"], has_elevator=True,
                              has_parking=True, is_villa=False, unit_per_floor=2,
                              lat=p["lat"], lon=p["lon"])
        features = scope["engineer_micro_features_dict"](req, {}, 2, encoding[slug])
        rows.append([features[k] for k in names])
        points.append(dict(id=i, slug=slug, neighborhood_fa=labels[slug], lat=p["lat"],
                           lon=p["lon"], neighborhood_encoded=encoding[slug]))
    ratios = predict(micro, rows)
    for point, ratio in zip(points, ratios, strict=True):
        point["predicted_q_ratio"] = ratio
    point_file = "district2_micro_points.json"
    write(point_file, dict(fixed_property=fixed, model_file=MICRO, feature_order=names,
          inference_notes="Raw Booster prediction. All distinct District 2 neighborhoods are ordered by local neighborhood encoding. Only coordinates and encoding vary. The API normally queries BigQuery for encoding. Warehouse and rebuilt status are unused by this model. Apartment, sale, two units per floor.",
          notes="Empty spatial input uses the feature engineer defaults: metro, highway and CBD distances 10000 m each, commercial density 0, urban decay 2, AQI 100, traffic zone 1, seismic risk 3. CBD is held at the feature engineer default instead of computing the query fallback from each coordinate.",
          points=points))
    counts = {point_file: len(points)}
    for prefix, model in [("micro", micro), ("macro", macro)]:
        name = prefix + "_feature_importance.json"
        features = importance(model)
        write(name, features)
        counts[name] = len(features)

    # Both output sets were manually inspected, including the macro training-data
    # preview and the SHAP plot. Detect changes before repeating that finding.
    import hashlib
    for book, expected in zip(BOOKS, OUTPUT_DIGESTS, strict=True):
        outputs = [cell.get("outputs", []) for cell in load(book)["cells"]]
        digest = hashlib.sha256(json.dumps(outputs, sort_keys=True).encode()).hexdigest()
        if digest != expected:
            raise ValueError(f"Reinspect changed notebook outputs in {book}")
    counts["export_manifest.json"] = 1
    write("export_manifest.json", dict(generator="defense_exports/generate_exports.py",
          records_by_file=counts, sources=[BACKEND, MICRO, MACRO, ENC, TS, *BOOKS],
          predicted_q_ratio_min=min(ratios), predicted_q_ratio_max=max(ratios),
          missing_items=["No saved numeric SHAP summary table or monthly regional test prediction table in either notebook's outputs."]))


OUTPUT_DIGESTS = ['f7b1b8c2fc26ba208410e1ab316b456e92b1070a0141700d8707a697645db9e4', 'c51a5b83b63d4fbae529c1d397b49cbc1217ae53be9dd641d075908f39007d72']

if __name__ == "__main__":
    prepared = Path("/workspace/.tehran-setup/venv/bin/python")
    if (not importlib.util.find_spec("xgboost") and prepared.exists()
            and Path(sys.executable) != prepared):
        os.execv(prepared, [str(prepared), __file__])
    main()
