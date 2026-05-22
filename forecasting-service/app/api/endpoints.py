from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import pandas as pd

from app.db.session import get_db
from app.features.pipeline import build_features
from app.models.xgboost_model import forecaster

router = APIRouter()

@router.get("/forecast/{store_id}/{sku_id}")
def get_forecast(store_id: int, sku_id: int, db: Session = Depends(get_db)):
    """
    Returns the predicted demand, confidence bounds, and recommended restock quantity.
    """
    # In a real implementation, we would query PostgreSQL for recent sales of this SKU/Store.
    # For simulation, we mock the dataframe retrieval.
    mock_sales = pd.DataFrame(columns=['sale_date', 'quantity_sold', 'store_region', 'category'])
    
    target_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # 1. Build features via pipeline
    features = build_features(mock_sales, target_date)
    
    # 2. Run Inference
    predicted_demand, lower_bound, upper_bound = forecaster.predict(features)
    
    # 3. Calculate recommended restock
    # We would fetch current available inventory here. Mocking as 5.
    current_inventory = 5 
    restock_qty = max(0, int(predicted_demand - current_inventory))
    
    return {
        "store_id": store_id,
        "sku_id": sku_id,
        "target_date": target_date,
        "predicted_demand": round(predicted_demand, 2),
        "confidence_interval": {
            "lower": round(lower_bound, 2),
            "upper": round(upper_bound, 2)
        },
        "recommended_restock_quantity": restock_qty,
        "model_version": "v1.0.0"
    }

@router.post("/train")
def trigger_training(background_tasks: BackgroundTasks):
    """
    Admin endpoint to trigger offline offline retraining.
    """
    def _train_task():
        # Load synthetic data
        try:
            # Mocking the synthetic load
            df = pd.DataFrame({
                f"feat_{i}": [0.5]*1000 for i in range(16)
            })
            df['target_quantity'] = [10]*1000
            forecaster.train(df)
        except Exception as e:
            print(f"Training failed: {e}")

    background_tasks.add_task(_train_task)
    return {"status": "Training initiated in background"}
