import pandas as pd
from app.models.xgboost_model import forecaster
from app.features.pipeline import build_features
import os

def main():
    print("Loading synthetic data for feature extraction...")
    if not os.path.exists('output/sales_records.csv'):
        print("Error: output/sales_records.csv not found. Run data/generator.py first.")
        return

    # Load raw sales data
    raw_sales = pd.read_csv('output/sales_records.csv')
    
    # We need to build the 16 features for each SKU-store combination.
    # For training, we normally generate features across the whole timeline.
    # To simplify this demo training script, we'll generate a mock feature dataset 
    # based on the aggregate behavior, or we can just train the forecaster directly.
    
    print("Generating feature vectors for XGBoost training...")
    
    # Simple aggregation to create training rows per SKU per store
    # In a full system, you would iterate weekly, creating a training row for each week.
    
    # For demonstration, we will train on a subset of data to save time.
    # Create a feature dataframe
    feature_rows = []
    
    # Group by store and SKU
    grouped = raw_sales.groupby(['store_id', 'sku_id'])
    count = 0
    
    for (store_id, sku_id), group in grouped:
        # Sort by date
        group = group.copy()
        group['sale_date'] = pd.to_datetime(group['sale_date'])
        group = group.sort_values('sale_date')
        
        # We'll use the last date as our target for this mock training row
        target_date = group['sale_date'].max()
        
        # Target quantity is the actual sale on that date
        target_quantity = group.iloc[-1]['quantity_sold']
        
        # Build features using history BEFORE the target date
        history = group[group['sale_date'] < target_date]
        
        if len(history) > 0:
            feat_vector = build_features(history, target_date.strftime("%Y-%m-%d"))
            
            row = {f"feat_{i}": feat_vector[0][i] for i in range(16)}
            row['target_quantity'] = target_quantity
            feature_rows.append(row)
            
        count += 1
        if count > 500: # Limit training data generation for demo speed
            break
            
    train_df = pd.DataFrame(feature_rows)
    print(f"Generated {len(train_df)} feature vectors. Commencing training...")
    
    forecaster.train(train_df)
    print("Training complete. Model saved.")

if __name__ == "__main__":
    main()
