FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 MEDISPHERE_DATA_DIR=/data
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY medisphere ./medisphere
COPY frontend ./frontend
RUN useradd -r -u 10001 app && mkdir /data && chown app /data
USER app
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fs http://localhost:8000/api/health || exit 1
CMD ["uvicorn", "medisphere.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
