# Model Files — Required for Inference

Place the following **three files** in this directory:

| File | Description |
|------|-------------|
| `macro_clean_model.json` | XGBoost Booster JSON — macro model (predicts base price/m²) |
| `micro_model.json` | XGBoost Booster JSON — micro model (predicts quality ratio) |
| `neighborhood_encoding.json` | Target-encoded neighborhood slugs (`{"saadat-abad": 1.25, ..., "GLOBAL_MEAN": 1.02}`) |

## Loading

Models are loaded **once at startup** via FastAPI's lifespan context manager in `main.py`.

```python
macro = xgb.Booster()
macro.load_model("models/macro_clean_model.json")
```

## Docker

When building the Docker image, these files are copied via `COPY models/ ./models/` in the Dockerfile.
Make sure the files exist before running `docker build`.

## Important

- Add `backend/models/*.json` to `.gitignore` — don't commit model weights to git.
- `GLOBAL_MEAN` key in `neighborhood_encoding.json` is the fallback for unknown slugs.
