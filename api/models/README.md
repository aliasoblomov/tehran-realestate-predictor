# Model Files — Required for Inference

Place the following **three files** in this directory before deploying to Vercel:

| File | Description |
|------|-------------|
| `macro_clean_model.json` | XGBoost Booster JSON — macro model (base price/m²) |
| `micro_model.json` | XGBoost Booster JSON — micro model (quality ratio) |
| `neighborhood_encoding.json` | Target-encoded neighborhood slugs (`{"saadat-abad": 1.25, ..., "GLOBAL_MEAN": 1.02}`) |

## Loading

Models are loaded in `../predict.py` using:

```python
import xgboost as xgb

booster = xgb.Booster()
booster.load_model("models/macro_clean_model.json")
```

## Important

- These files are **not** committed to git (add to `.gitignore` if needed).
- The `GLOBAL_MEAN` key in `neighborhood_encoding.json` is used as a fallback for unknown neighborhoods.
- Model files must be in XGBoost's native JSON format (saved with `booster.save_model("model.json")`).
