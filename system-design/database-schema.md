# Database Schema Design

StoreSync utilizes PostgreSQL as its primary transactional datastore. The schema is normalized for consistency but heavily indexed to support high-throughput concurrent reads and writes typical in retail checkout flows.

## Core Schema Structure

### Inventory Table
The source of truth for stock levels. Uses Optimistic Concurrency Control (OCC) via the `version` column to prevent lost updates during high-concurrency reservation flows.

```sql
CREATE TABLE inventory (
    sku_id VARCHAR(50) NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sku_id, store_id)
);

CREATE INDEX idx_inventory_store ON inventory(store_id);
```

### Transaction & Reservation Tables
Captures point-in-time checkout states and pending reservations.

```sql
CREATE TABLE checkout_transactions (
    transaction_id UUID PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL, -- PENDING, COMPLETED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reservations (
    reservation_id UUID PRIMARY KEY,
    transaction_id UUID REFERENCES checkout_transactions(transaction_id),
    sku_id VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_reservations_expiry ON reservations(expires_at);
```

### ML Forecast Table
Stores batch inference outputs from the XGBoost pipeline.

```sql
CREATE TABLE demand_forecasts (
    forecast_id BIGSERIAL PRIMARY KEY,
    sku_id VARCHAR(50) NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    target_date DATE NOT NULL,
    predicted_demand INTEGER NOT NULL,
    confidence_lower INTEGER NOT NULL,
    confidence_upper INTEGER NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_forecast_sku_date ON demand_forecasts(sku_id, store_id, target_date);
```

## Indexing & Partitioning Strategy

- **B-Tree Indexes:** Applied to all foreign keys and frequently queried columns (e.g., `store_id`).
- **Time-Series Partitioning:** The `checkout_transactions` and `demand_forecasts` tables are designed to be partitioned by `created_at` / `target_date` (e.g., monthly partitions) to ensure consistent query performance as historical data grows.

## Read/Write Patterns & Consistency
The database is heavily optimized for write-heavy bursts during simulated holiday traffic. 
- **Reads:** Offloaded primarily to Redis. Database reads are reserved for cache-misses and asynchronous background reconciliation.
- **Writes:** Executed against PostgreSQL. The schema strictly enforces non-negative constraints (`CHECK (available_quantity >= 0)`) to act as a fail-safe against race conditions that bypass application-layer logic.
