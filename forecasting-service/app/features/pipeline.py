import pandas as pd
import numpy as np

def build_features(sales_history_df, target_date):
    """
    Computes 16 engineered features for the XGBoost model.
    sales_history_df: DataFrame of historical sales for a specific SKU-store pair.
    target_date: The date to forecast.
    """
    if sales_history_df.empty:
        # Fallback if no history is present (e.g., brand new SKU)
        return generate_fallback_features(target_date)

    # Ensure datetime format and sort
    sales_history_df['sale_date'] = pd.to_datetime(sales_history_df['sale_date'])
    sales_history_df = sales_history_df.sort_values('sale_date')

    # Resample to weekly data if daily
    sales_history_df.set_index('sale_date', inplace=True)
    weekly_sales = sales_history_df['quantity_sold'].resample('W-MON').sum().reset_index()
    
    # We need the most recent weeks leading up to target_date
    weekly_sales = weekly_sales[weekly_sales['sale_date'] < pd.to_datetime(target_date)]

    if len(weekly_sales) < 8:
        # Not enough history for full lag features
        return generate_fallback_features(target_date)

    # Features
    sales_T_1 = weekly_sales.iloc[-1]['quantity_sold']
    sales_T_2 = weekly_sales.iloc[-2]['quantity_sold']
    sales_T_4 = weekly_sales.iloc[-4]['quantity_sold']
    sales_T_8 = weekly_sales.iloc[-8]['quantity_sold']

    last_4_weeks = weekly_sales.iloc[-4:]['quantity_sold']
    rolling_mean_4w = last_4_weeks.mean()
    rolling_std_4w = last_4_weeks.std() if len(last_4_weeks) > 1 else 0

    target_dt = pd.to_datetime(target_date)
    week_of_year = target_dt.isocalendar()[1]
    month = target_dt.month
    quarter = target_dt.quarter
    day_of_week = target_dt.weekday()
    
    # Simplified holiday logic
    is_holiday = 1 if month == 11 and week_of_year >= 47 else 0 

    store_region = sales_history_df['store_region'].iloc[0] if 'store_region' in sales_history_df else 1
    category = sales_history_df['category'].iloc[0] if 'category' in sales_history_df else 1
    
    # Historical Averages
    store_hist_avg = weekly_sales['quantity_sold'].mean()
    sku_global_avg = store_hist_avg  # In a full query, this would be grouped by SKU globally

    features = [
        sales_T_1, sales_T_2, sales_T_4, sales_T_8,
        rolling_mean_4w, rolling_std_4w,
        week_of_year, month, quarter, is_holiday, day_of_week,
        store_region, store_hist_avg,
        category, sku_global_avg,
        1.0 # Bias/placeholder
    ]
    
    return np.array(features).reshape(1, -1)

def generate_fallback_features(target_date):
    target_dt = pd.to_datetime(target_date)
    return np.array([
        0, 0, 0, 0, # lags
        0, 0, # rolling
        target_dt.isocalendar()[1], target_dt.month, target_dt.quarter, 0, target_dt.weekday(),
        1, 0, 1, 0, 1.0
    ]).reshape(1, -1)
