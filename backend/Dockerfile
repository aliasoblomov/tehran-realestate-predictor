# Dockerfile for Tehran Real Estate Predictor — FastAPI Backend V2
# Optimized for Google Cloud Run deployment

FROM python:3.11-slim

# System deps for google-cloud-bigquery and xgboost
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Copy model files
COPY models/ ./models/

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Use exec form (not sh -c) so uvicorn receives SIGTERM correctly.
# Workers=1 keeps memory predictable; host must be 0.0.0.0 for Cloud Run.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-keep-alive", "120"]
