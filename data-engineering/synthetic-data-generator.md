# Synthetic Retail Data Generator

StoreSync relies on a sophisticated synthetic data generation pipeline to simulate enterprise-scale retail workloads. This pipeline creates mathematically sound, realistic sales histories used to train the XGBoost forecasting model.

## Why Synthetic Workloads?
Relying on static, small-scale toy datasets fails to stress test distributed systems or machine learning pipelines. By generating synthetic data, StoreSync can:
1. **Benchmark at Scale:** Generate billions of rows to test database partitioning and Kafka stream processing limits.
2. **Simulate Anomalies:** Inject controlled holiday spikes, regional outages, and fraud patterns to test the resilience of the sliding-window algorithms and OCC locks.
3. **Control Variables:** Precisely control cardinality (number of stores, SKUs, user distributions) to measure how the architecture responds to specific bottlenecks.

## Generator Architecture

The generator utilizes Numpy and Pandas to simulate retail physics over a 2-year historical period:

### 1. Base Demand Modeling
Every SKU is assigned a baseline daily demand using a Poisson distribution.
`base_demand = np.random.poisson(lam=baseline_rate)`

### 2. Seasonality & Holiday Spikes
Demand is modulated using trigonometric functions to simulate weekly and annual seasonality. Holiday spikes (e.g., Black Friday, Back to School) are injected using Gaussian multipliers centered on specific dates.

### 3. Regional Variation & Noise
Store locations are assigned regional multipliers (e.g., a snow shovel sells better in Chicago than Dallas in December). Finally, Gaussian noise is injected to prevent the XGBoost model from simply memorizing deterministic formulas, forcing it to learn generalized feature weights.

### 4. Fraud Pattern Generation
A percentage of generated transactions are clustered to originate from identical IP addresses or user IDs within narrow time windows, simulating automated botnets attempting to scalp limited inventory. This directly tests the Checkout Service's Redis-backed rate-limiting and fraud detection logic.
