FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home app
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .
COPY start-api.sh .
RUN mkdir -p /app/uploads && chown app:app /app/uploads
USER app
EXPOSE 8000
CMD ["sh", "/app/start-api.sh"]
