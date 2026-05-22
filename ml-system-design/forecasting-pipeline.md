# Machine Learning Forecasting Pipeline

StoreSync integrates a production-grade machine learning pipeline to predict SKU-level demand. Rather than relying on simple moving averages, the system utilizes an XGBoost regressor trained on heavily engineered time-series features.

## Architecture & Model Selection

### Why XGBoost over Deep Learning (LSTMs / Transformers)?
In retail demand forecasting (where data is heavily tabular, seasonal, and requires explicit interpretability for supply chain managers), gradient boosted decision trees (XGBoost) consistently outperform deep learning approaches. 
1. **Computational Efficiency:** XGBoost trains in seconds on CPUs, avoiding the need for expensive GPU inference clusters.
2. **Tabular Superiority:** XGBoost excels at handling sparse, tabular categorical data (Store IDs, Region Codes) mixed with continuous variables (Prices, Lags).
3. **Interpretability:** Feature importance mapping allows engineers to understand exactly *why* a surge was predicted.

## Feature Engineering Pipeline

The raw Kafka stream (`checkout.completed`) is aggregated into daily buckets and processed through a Pandas-based feature engineering pipeline before inference.

Core features include:
- **Temporal Lags:** Sales for `T-1`, `T-7`, and `T-30` days.
- **Rolling Averages:** 7-day and 30-day moving averages to smooth daily volatility.
- **Seasonality Indicators:** Day of week, Month, and Holiday boolean flags.
- **Categorical Encodings:** Target encoding for Store IDs and SKU IDs.

## Inference API Design

The prediction serving layer is built with FastAPI. It loads the pre-trained `xgboost_model.joblib` artifact into memory upon startup.
- **Batch Processing:** It supports batched inference payloads to maximize throughput.
- **Confidence Intervals:** The model outputs not just a point prediction, but upper and lower confidence bounds (using quantile regression objectives) to allow downstream supply chain algorithms to calculate precise safety stock levels.
