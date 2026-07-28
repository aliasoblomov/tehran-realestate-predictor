# Dockerfile for Tehran Real Estate Predictor — FastAPI Backend
# Optimized for Hugging Face Spaces deployment

FROM python:3.11-slim

# System deps for google-cloud-bigquery and xgboost
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Copy model files (place them in backend/models/ before building)
COPY models/ ./models/

# Expose port 7860 for Hugging Face Spaces
EXPOSE 7860

# Run with uvicorn on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
