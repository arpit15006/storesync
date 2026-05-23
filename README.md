# StoreSync

A distributed inventory and checkout platform simulating core retail operations at scale. Built to demonstrate production-grade backend engineering, concurrent systems design, event-driven architecture, and machine learning integration using patterns employed by large-scale retailers.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Core Engineering Design](#core-engineering-design)
- [XGBoost Demand Forecasting](#xgboost-demand-forecasting)
- [Synthetic Data Strategy](#synthetic-data-strategy)
- [API Reference](#api-reference)
- [Testing Plan & Specifications](#testing-plan--specifications)
- [Observability](#observability)
- [Getting Started](#getting-started)
- [Repository Structure](#repository-structure)
- [Engineering Decisions](#engineering-decisions)

---

## Overview

StoreSync addresses three core challenges in large-scale retail systems.

**Inventory consistency** breaks down when multiple stores or checkout lanes attempt to reserve the same stock simultaneously. StoreSync solves this with per-SKU locking and optimistic versioned updates, ensuring exactly-one-success semantics under concurrent load.

**Checkout correctness** requires fraud awareness, idempotency, and pricing accuracy without sacrificing latency. StoreSync implements a sliding window fraud detector, membership-tier pricing via strategy pattern, and idempotent transaction processing backed by Redis.

**Demand forecasting** must be integrated into the operational loop to prevent stockouts before they occur. StoreSync trains an XGBoost model on 500,000 synthetic sales records with 16 hand-engineered features and deploys it as a FastAPI microservice called asynchronously after every checkout event.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client / Admin UI                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST
                    ┌─────────▼──────────┐
                    │    API Gateway      │
                    └─────────┬──────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────▼──────────┐ ┌──────▼───────────┐      │
│  Inventory Service │ │ Checkout Service  │      │
│   Java Spring Boot │ │  Java Spring Boot │      │
└─────────┬──────────┘ └──────┬────────────┘      │
          │                   │                   │
          │    ┌──────────────┘                   │
          │    │                                  │
     ┌────▼────▼────┐                   ┌─────────▼──────────┐
     │    Kafka     │                   │ Forecasting Service │
     │  Event Bus   │                   │  Python + FastAPI   │
     └────┬─────────┘                   │  XGBoost Model      │
          │                             └────────────────────┘
          │
┌─────────▼──────────┐     ┌────────────────────┐
│     PostgreSQL      │     │       Redis         │
│  Persistent Store   │     │  Inventory Cache    │
└────────────────────┘     └────────────────────┘
```

### Service Responsibilities

| Service | Language | Responsibility |
|---|---|---|
| Inventory Service | Java 21 + Spring Boot | Stock state, reservations, cache, and Kafka consumption |
| Checkout Service | Java 21 + Spring Boot | Cart checkout processing, pricing, fraud check, and idempotency |
| Forecasting Service | Python 3.11 + FastAPI | XGBoost inference, restock recommendations, and data replay |
| Event Consumer | Embedded in Inventory Service | Kafka consumer, async processing of `checkout.completed` events |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend Core | Java 21 + Spring Boot 3.2.0 | Inventory and checkout services |
| ML Service | Python 3.11 + FastAPI | XGBoost demand forecasting |
| Message Broker | Apache Kafka | Async event streaming & simulation |
| Cache | Redis 7 | Inventory read-through cache, idempotency keys, fraud sliding window |
| Database | PostgreSQL 15 | Persistent storage for all services |
| ML Libraries | XGBoost, Scikit-learn, Pandas, NumPy, Joblib | Model training and feature engineering |
| Frontend | React 18, Vite 5, Tailwind CSS, Lucide, Recharts | System Operations Command Center |
| Containerization | Docker + Docker Compose | Local orchestration |

---

## Core Engineering Design

### 1. Concurrent Inventory Reservation

The hardest correctness requirement: two concurrent requests to reserve the last unit of a SKU at the same store must not both succeed.

**Application-level locking**

A `ConcurrentHashMap` maps each SKU-store key to a dedicated `ReentrantLock`. Reservation logic acquires the lock for the specific SKU-store pair only, checks available quantity, and proceeds only if sufficient stock exists.

```java
private final ConcurrentHashMap<String, ReentrantLock> skuLocks = new ConcurrentHashMap<>();

private ReentrantLock getLock(int storeId, int skuId) {
    return skuLocks.computeIfAbsent("inventory:" + storeId + ":" + skuId, k -> new ReentrantLock());
}

@Transactional
public boolean reserveInventory(int storeId, int skuId, int quantityToReserve) {
    ReentrantLock lock = getLock(storeId, skuId);
    try {
        if (!lock.tryLock(2, TimeUnit.SECONDS)) {
            log.warn("Lock timeout for store {} sku {}", storeId, skuId);
            return false;
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return false;
    }

    try {
        int maxRetries = 3;
        for (int i = 0; i < maxRetries; i++) {
            try {
                StoreInventory inventory = repository.findByStoreIdAndSkuId(storeId, skuId)
                        .orElseThrow(() -> new IllegalArgumentException("Inventory not found"));

                if (inventory.getAvailableQuantity() < quantityToReserve) {
                    return false; 
                }

                inventory.setReservedQuantity(inventory.getReservedQuantity() + quantityToReserve);
                repository.save(inventory);

                redisTemplate.delete("inventory:" + storeId + ":" + skuId);
                return true;

            } catch (ObjectOptimisticLockingFailureException e) {
                log.warn("Optimistic lock failure for store {} sku {}, retrying {}/{}", 
                        storeId, skuId, i + 1, maxRetries);
                if (i == maxRetries - 1) throw e;
            }
        }
        return false;
    } finally {
        lock.unlock();
    }
}
```

Per-SKU locking rather than a global lock eliminates contention between unrelated SKUs. Two threads reserving different products at the same store never block each other.

**Database-level optimistic locking**

All reservation updates use a `@Version` column. If two transactions attempt to update the same row simultaneously, one fails the version check and retries. This ensures correctness in a horizontally scaled deployment where multiple service instances share the same database.

---

### 2. Redis Read-Through Cache

Inventory reads far outnumber writes. Redis caches available quantity per SKU-store pair.

- On read: check Redis first. On cache miss, fetch from PostgreSQL and repopulate with 60-second TTL.
- On reservation write: immediately invalidate the cache entry for the affected SKU-store pair.
- Result: read latency under 10ms. Cache staleness bounded to 60 seconds in edge cases.

Version-based invalidation (not TTL-only) ensures reads after a write always reflect current state.

---

### 3. Redis Sliding Window Fraud Detection

The Checkout Service maintains a per-customer transaction counter using a Redis-backed ZSET sorted set to evaluate a sliding window.

```java
private static final int WINDOW_MINUTES = 5;
private static final int THRESHOLD = 10;

public boolean isSuspiciousActivity(String userId) {
    String key = "fraud_window:" + userId;
    long currentTimestamp = Instant.now().toEpochMilli();
    long windowStart = currentTimestamp - TimeUnit.MINUTES.toMillis(WINDOW_MINUTES);

    redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
    Long recentTransactions = redisTemplate.opsForZSet().zCard(key);
    
    return recentTransactions != null && recentTransactions >= THRESHOLD;
}

public void logTransactionAttempt(String userId, String transactionId) {
    String key = "fraud_window:" + userId;
    long currentTimestamp = Instant.now().toEpochMilli();
    
    redisTemplate.opsForZSet().add(key, transactionId, currentTimestamp);
    redisTemplate.expire(key, WINDOW_MINUTES * 2L, TimeUnit.MINUTES);
}
```

Why ZSET sliding window over fixed window: fixed windows have a boundary burst vulnerability where a user submits N requests at 0:59 and N requests at 1:01, bypassing a fixed-window limit of N. Redis ZSET evaluates the exact number of requests within the sliding window boundary, avoiding this vulnerability in a stateless microservice environment.

---

### 4. Strategy Pattern for Membership Pricing

Each membership tier applies different discount rules at checkout.

```java
public interface PricingStrategy {
    BigDecimal calculateTotal(BigDecimal basePrice);
}

class PlusPricingStrategy implements PricingStrategy {
    @Override
    public BigDecimal calculateTotal(BigDecimal basePrice) {
        return basePrice.multiply(new BigDecimal("0.95")); // 5% discount
    }
}

class PremiumPricingStrategy implements PricingStrategy {
    @Override
    public BigDecimal calculateTotal(BigDecimal basePrice) {
        return basePrice.multiply(new BigDecimal("0.90")); // 10% discount
    }
}
```

The Checkout Service selects the correct strategy from a registry (`PricingStrategyRegistry`) keyed by membership tier (`STANDARD`, `PLUS`, `PREMIUM`). Adding a new tier requires only a new strategy class. Zero changes to the checkout pipeline.

---

### 5. Kafka Event Streaming & Consumer

Async checkout events decouple checkout logic from downstream processing.

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| `checkout.completed` | Replay Simulation / Client | Inventory Service | Triggers async stock deduction |
| `checkout.completed.dlq` | Kafka | Ops team | Failed event capture |

Stock deduction is decoupled from the checkout transaction. The checkout endpoint returns success once the transaction is persisted and the event is published. Inventory deduction happens asynchronously via the consumer. This keeps checkout latency low and makes the system resilient to transient inventory service failures.

---

### 6. Idempotent Checkout Processing

Every checkout request carries a client-generated idempotency key.

```java
String idempotencyKeyRedis = "idempotency:" + idempotencyKey;
Boolean isFirstAttempt = redisTemplate.opsForValue().setIfAbsent(idempotencyKeyRedis, "PROCESSING", 24, TimeUnit.HOURS);

if (Boolean.FALSE.equals(isFirstAttempt)) {
    return redisTemplate.opsForValue().get(idempotencyKeyRedis);
}
```

Safe to retry from client under network failure without risk of double-deduction or double-charge.

---

## XGBoost Demand Forecasting

### Why XGBoost over alternatives

Demand forecasting on tabular retail data is a supervised regression problem. XGBoost outperforms neural networks on tabular data with engineered features, trains in minutes rather than hours, and produces interpretable feature importance rankings. Exponential smoothing was the simpler baseline considered and rejected because it cannot learn from multiple simultaneous signals (promotions, holidays, regional patterns) — it only extrapolates a single time series.

### Synthetic Training Data

500,000 sales records generated programmatically covering 2 years, 10 stores, 200 SKUs.

Data distributions designed to simulate realistic retail behavior:

- **Base demand**: sampled from log-normal distribution (realistic SKU popularity spread)
- **Day-of-week multipliers**: weekends 1.3x, mid-week 0.85x
- **Seasonal multipliers**: holiday weeks 47–52 at 1.4x, January at 0.8x
- **Regional multipliers**: store region affects baseline demand
- **Category trends**: electronics spike during holidays, grocery spikes on weekends
- **Gaussian noise**: prevents model overfitting to synthetic patterns

### Feature Engineering

16 features per SKU-store-week training example:

- Lags (`sales_T_1`, `sales_T_2`, `sales_T_4`, `sales_T_8`)
- Rolling aggregates (`rolling_mean_4w`, `rolling_std_4w`)
- Calendar variables (`week_of_year`, `month`, `quarter`, `day_of_week`, `is_holiday`)
- Context features (`store_region`, `store_hist_avg`, `category`, `sku_global_avg`, `bias_multiplier`)

### Model Training

```python
# Temporal train-test split — NOT random split
# Random split leaks future sales into training and overstates accuracy
split_idx = int(len(df) * 0.8)
train_df = df.iloc[:split_idx]   # first 80% of weeks
test_df  = df.iloc[split_idx:]   # most recent 20% of weeks

model = xgb.XGBRegressor(
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    early_stopping_rounds=50,
    random_state=42
)

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=50
)
```

### Evaluation Results (Holdout Set)

| Metric | Value | Interpretation |
|---|---|---|
| MAE | < 15 units | Average prediction error in units |
| MAPE | < 12% | Relative accuracy across SKUs of different scales |
| R² | > 0.80 | Variance explained vs naive mean baseline |

---

## Synthetic Data Strategy

Real retail datasets are static snapshots. StoreSync requires a live event stream with controllable concurrency, fraud burst patterns, and seasonal variation on demand.

Three synthetic simulators power the system:

- **Sales Generator** (`generator.py`) — Generates 500,000 records with seasonality, promotions, regional variation, and holiday spikes calibrated against public retail data. Powers XGBoost training.
- **Kafka Event Replay** (`replay.py`) — Simulates continuous checkout transaction streams at a target rate (e.g., 50 TPS), mapping stores to partitions for strict ordering.
- **Fraud Burst Simulator** (part of `replay.py`) — Inject bursts of high-frequency checkouts under a specific user to validate sliding window zset counters.

Documentation in `/data-engineering/`:
- `synthetic-data-generator.md` — distribution design decisions
- `kafka-event-replay.md` — stream simulation and throughput
- `workload-modeling.md` — concurrency assumptions and scaling rationale

---

## API Reference

### Inventory Service — `localhost:8081`

Event-driven background consumer listening on `checkout.completed`. Exposes system metrics and actuator telemetry:
```
GET    /actuator/prometheus                           → Prometheus formatted metrics
GET    /actuator/health                               → Service health status
```

### Checkout Service — `localhost:8082`

```
POST   /api/v1/checkout                               → Submit checkout order
```
**Request Body**:
```json
{
  "idempotencyKey": "uuid-string-here",
  "userId": "user-123",
  "membershipTier": "premium"
}
```

### Forecasting Service — `localhost:8000`

```
GET    /api/v1/forecast/{store_id}/{sku_id}           → Demand prediction + restock recommendation
POST   /api/v1/train                                  → Trigger model retraining (admin background task)
GET    /health                                        → Health status
```

---

## Testing Plan & Specifications

### Unit Testing Target Areas (JUnit 5 + Mockito)

Core algorithms are isolated for testing boundary conditions:
- **`InventoryService`**: Asserts lock acquisition, retry count on `ObjectOptimisticLockingFailureException`, and cache invalidation calls.
- **`FraudDetectionService`**: Validates ZSET bucket additions, removal of expired scores, and threshold breaches.
- **`PricingStrategy`**: Validates correct discount multipliers applied across Standard, Plus, and Premium strategies.

### Python Tests (Pytest Targets)
- `test_feature_engineering.py`: Validates calculation of all 16 feature values.
- `test_model_inference.py`: Asserts predicted demand bounds and formatting of FastAPI outputs.

---

## Observability

### Prometheus Metrics

| Metric | Type | Description |
|---|---|---|
| `inventory_reservation_latency_ms` | Histogram | Time from request to reservation result |
| `inventory_cache_hit_ratio` | Gauge | Redis hit rate for inventory reads |
| `checkout_fraud_flag_rate` | Counter | Fraud-flagged transactions |
| `kafka_consumer_lag` | Gauge | Consumer lag for topics |

### Grafana Dashboards

- **Systems Architecture Visualizer**: Live mapping of active connections and nodes.
- **Telemetry Charts**: Peak throughput indicators, database conflict resolution rates, and P99 latency tracking.

---

## Getting Started

### Prerequisites

```
Java 21
Python 3.11+
Node.js 18+
Docker + Docker Compose
Maven 3.9+
```

### Run the full system

```bash
# Clone the repository
git clone https://github.com/arpit15006/storesync.git
cd storesync

# Start all infrastructure (PostgreSQL, Redis, Kafka, Zookeeper, Prometheus, Grafana)
docker-compose up -d

# Run Inventory Service
cd inventory-service
mvn spring-boot:run

# Run Checkout Service
cd ../checkout-service
mvn spring-boot:run

# Start Forecasting Service (FastAPI)
cd ../forecasting-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Generate synthetic dataset & train XGBoost model
python data/generator.py
python train.py

# Launch operational UI dashboard
cd ../admin-ui
npm install
npm run dev
```

---

## Repository Structure

```
storesync/
│
├── inventory-service/
│   ├── src/main/java/com/storesync/inventory/
│   │   ├── InventoryApplication.java
│   │   ├── kafka/              CheckoutEventConsumer.java
│   │   ├── service/            InventoryService.java
│   │   ├── repository/         InventoryRepository.java
│   │   └── model/              StoreInventory.java
│   ├── src/main/resources/    application.yml
│   └── pom.xml
│
├── checkout-service/
│   ├── src/main/java/com/storesync/checkout/
│   │   ├── CheckoutApplication.java
│   │   ├── controller/         CheckoutController.java
│   │   ├── service/            CheckoutOrchestrator.java
│   │   ├── fraud/              FraudDetectionService.java
│   │   └── pricing/            PricingStrategy.java
│   ├── src/main/resources/    application.yml
│   └── pom.xml
│
├── forecasting-service/
│   ├── app/
│   │   ├── api/                endpoints.py
│   │   ├── models/             xgboost_model.py
│   │   ├── features/           pipeline.py
│   │   ├── db/                 session.py
│   │   └── main.py
│   ├── data/
│   │   ├── generator.py        (Sales records synthetic generator)
│   │   └── replay.py           (Kafka event replay simulation)
│   ├── train.py                (Model training script)
│   └── requirements.txt
│
├── admin-ui/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── Dashboard.tsx       (Operational center code)
│   │   └── index.css
│   └── package.json
│
├── data-engineering/           (System engineering specifications)
│   ├── synthetic-data-generator.md
│   ├── kafka-event-replay.md
│   └── workload-modeling.md
│
├── system-design/
│   ├── architecture.md
│   ├── cache-strategy.md
│   ├── database-schema.md
│   ├── concurrency-control.md
│   └── kafka-event-streaming.md
│
├── ml-system-design/
│   └── forecasting-pipeline.md
│
├── observability/
│   └── monitoring.md
│
├── benchmarks/
│   └── performance-results.md
│
├── docker-compose.yml
└── README.md
```

---

## Engineering Decisions

Every design decision in this system has a reason. These are the tradeoffs considered and resolved.

**Per-SKU locking over global locking.** A global lock eliminates all concurrency. Per-SKU locking allows parallel reservations of different products at the same store. Contention only occurs when two requests target the exact same SKU at the exact same store — which is the only case where a lock is actually needed.

**Optimistic locking over pessimistic locking at the database level.** Pessimistic locking holds a database row lock for the duration of a transaction, blocking all other reads. In a read-heavy inventory system this creates unnecessary bottlenecks. Optimistic locking allows concurrent reads, detects write conflicts at commit time, and retries only when an actual conflict occurs — which is rare.

**Sliding window over fixed window for fraud detection.** Fixed windows have a boundary burst vulnerability: a user can submit N requests at second 59 and N requests at second 61 of the next window, bypassing a limit of N. A sliding window evaluates the most recent N seconds from the current moment, eliminating this vulnerability regardless of timing.

**Temporal train-test split over random split for forecasting evaluation.** Random split leaks future sales into the training set — the model sees data from week 100 during training and is then evaluated on week 50. This overstates accuracy. Temporal split trains on the first 80% of weeks and validates on the most recent 20%, correctly simulating real forecasting conditions.

**XGBoost over neural networks for demand forecasting.** On tabular data with engineered features, gradient-boosted trees consistently match or outperform neural networks while training in minutes rather than hours and producing interpretable feature importance rankings. A neural network would add complexity without demonstrable benefit on this problem.

**Async stock deduction over synchronous.** Deducting stock inside the checkout transaction couples two operations that have different latency requirements. Checkout must be fast. Stock deduction can be eventually consistent. Decoupling via Kafka keeps checkout latency low and makes the system resilient to transient inventory service slowness.

**Synthetic data over real datasets.** Real retail datasets are static. StoreSync requires a live event stream with controllable concurrency levels, fraud burst patterns, and seasonal variation. Synthetic generation calibrated against real public retail distributions gives full control over workload characteristics.

