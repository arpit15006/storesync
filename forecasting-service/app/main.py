from fastapi import FastAPI
from app.api import endpoints

app = FastAPI(
    title="StoreSync Forecasting Service",
    description="Provides ML-based demand forecasting utilizing an XGBoost regression model trained on synthetic retail workloads.",
    version="1.0.0"
)

app.include_router(endpoints.router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "forecasting"}

# Prometheus metrics setup could be added here using prometheus_fastapi_instrumentator
