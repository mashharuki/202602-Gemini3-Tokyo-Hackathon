FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Runtime dependencies for the AI agent backend.
RUN pip install --upgrade pip && \
    pip install \
      "google-adk>=1.22.1" \
      "fastapi>=0.115.0" \
      "uvicorn>=0.32.0" \
      "python-dotenv>=1.0.0" \
      "websockets>=13.0"

# Copy backend source (main.py, my_agent, static assets, etc.).
COPY . /app

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
