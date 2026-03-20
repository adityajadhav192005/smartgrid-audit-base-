FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 \
    && pip install -r /app/requirements.txt

COPY backend_railway /app/backend_railway
COPY smartgrid_mas /app/smartgrid_mas

EXPOSE 8080

CMD ["sh", "-c", "uvicorn smartgrid_mas.api.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
