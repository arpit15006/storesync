import pandas as pd
import numpy as np
import uuid
from datetime import datetime, timedelta
import os

# Configuration
NUM_STORES = 10
NUM_SKUS = 200
YEARS = 2
START_DATE = datetime(2022, 1, 1)

CATEGORIES = [
    {"id": 1, "name": "Grocery", "weekend_mult": 1.4, "holiday_mult": 1.2},
    {"id": 2, "name": "Electronics", "weekend_mult": 1.1, "holiday_mult": 2.5},
    {"id": 3, "name": "Apparel", "weekend_mult": 1.3, "holiday_mult": 1.5},
    {"id": 4, "name": "Home", "weekend_mult": 1.2, "holiday_mult": 1.3}
]

REGIONS = [1, 2, 3, 4]

# Predefined US Holidays (Simplified)
HOLIDAYS = {
    "2022-11-24": "Thanksgiving",
    "2022-11-25": "Black Friday",
    "2022-12-24": "Christmas Eve",
    "2022-12-25": "Christmas Day",
    "2023-11-23": "Thanksgiving",
    "2023-11-24": "Black Friday",
    "2023-12-24": "Christmas Eve",
    "2023-12-25": "Christmas Day",
}

def generate_sku_metadata():
    skus = []
    for i in range(1, NUM_SKUS + 1):
        cat = np.random.choice(CATEGORIES)
        # Log-normal distribution for base demand (few very popular items, many niche items)
        base_demand = np.random.lognormal(mean=2.0, sigma=0.8) 
        unit_price = round(np.random.uniform(5.0, 500.0), 2)
        skus.append({
            "sku_id": i,
            "category_id": cat["id"],
            "base_demand": max(1, int(base_demand)),
            "unit_price": unit_price,
            "weekend_mult": cat["weekend_mult"],
            "holiday_mult": cat["holiday_mult"]
        })
    return pd.DataFrame(skus)

def generate_store_metadata():
    stores = []
    for i in range(1, NUM_STORES + 1):
        region = np.random.choice(REGIONS)
        # Regional multipliers (e.g., Region 1 is 20% busier)
        region_mult = 1.0 + (region - 2) * 0.1 
        stores.append({
            "store_id": i,
            "region": region,
            "region_mult": max(0.5, region_mult)
        })
    return pd.DataFrame(stores)

def generate_sales_data(skus_df, stores_df):
    records = []
    end_date = START_DATE + timedelta(days=YEARS * 365)
    
    date_list = [START_DATE + timedelta(days=x) for x in range((end_date - START_DATE).days)]
    
    print("Generating simulated daily sales...")
    
    for current_date in date_list:
        date_str = current_date.strftime("%Y-%m-%d")
        is_holiday = date_str in HOLIDAYS
        day_of_week = current_date.weekday() # 0 = Monday, 6 = Sunday
        is_weekend = day_of_week >= 5
        
        # Seasonality: peak in late Nov/Dec (weeks 47-52), trough in Jan (weeks 1-4)
        week_of_year = current_date.isocalendar()[1]
        seasonal_mult = 1.0
        if 47 <= week_of_year <= 52:
            seasonal_mult = 1.4
        elif 1 <= week_of_year <= 4:
            seasonal_mult = 0.8
            
        for _, store in stores_df.iterrows():
            # Not every SKU sells every day in every store (sparsity)
            active_skus = skus_df.sample(frac=0.6) 
            
            for _, sku in active_skus.iterrows():
                # Base calculation
                expected_demand = sku['base_demand'] * store['region_mult'] * seasonal_mult
                
                # Weekend / Holiday effects
                if is_holiday:
                    expected_demand *= sku['holiday_mult']
                elif is_weekend:
                    expected_demand *= sku['weekend_mult']
                else:
                    expected_demand *= 0.85 # Mid-week dip
                    
                # Inject Gaussian noise to prevent perfect model overfitting
                noise = np.random.normal(0, expected_demand * 0.15)
                final_quantity = max(0, int(round(expected_demand + noise)))
                
                if final_quantity > 0:
                    records.append({
                        "sale_id": str(uuid.uuid4()),
                        "store_id": store['store_id'],
                        "sku_id": sku['sku_id'],
                        "sale_date": current_date.strftime("%Y-%m-%d"),
                        "quantity_sold": final_quantity,
                        "unit_price": sku['unit_price'],
                        "is_holiday": is_holiday,
                        "store_region": store['region'],
                        "category": sku['category_id']
                    })

    df = pd.DataFrame(records)
    return df

def main():
    np.random.seed(42)
    print("Starting Synthetic Data Generation...")
    
    skus_df = generate_sku_metadata()
    stores_df = generate_store_metadata()
    
    print(f"Generated {len(skus_df)} SKUs and {len(stores_df)} Stores.")
    
    sales_df = generate_sales_data(skus_df, stores_df)
    
    print(f"Generated {len(sales_df)} total sales records.")
    
    os.makedirs('output', exist_ok=True)
    sales_df.to_csv('output/sales_records.csv', index=False)
    skus_df.to_csv('output/skus.csv', index=False)
    stores_df.to_csv('output/stores.csv', index=False)
    
    print("Data saved to output/ directory.")

if __name__ == "__main__":
    main()
