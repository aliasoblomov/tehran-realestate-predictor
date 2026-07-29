# Dockerfile for Tehran Real Estate Predictor — FastAPI Backend
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

# Copy model files (place them in backend/models/ before building)
COPY models/ ./models/

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Run with uvicorn using $PORT for Cloud Run
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
