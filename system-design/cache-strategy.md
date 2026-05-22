# Caching Strategy

To support high-velocity read operations during checkout traffic spikes, StoreSync employs a strict **Read-Through caching architecture** backed by Redis. This offloads 95%+ of read queries from the primary PostgreSQL database, ensuring database connections are reserved for transactional writes.

## Redis Read-Through Architecture

When a client queries SKU availability or price:
1. The Checkout Service checks Redis (`GET inventory:store_1:sku_102`).
2. **Cache Hit:** The integer value is returned immediately (~1ms latency).
3. **Cache Miss:** The service queries PostgreSQL, writes the result to Redis (`SETEX inventory:store_1:sku_102 3600 [value]`), and returns the data.

## Cache Consistency & Invalidation
Because StoreSync relies on eventual consistency via Kafka, the cache must be aggressively managed to prevent stale reads leading to mass checkout failures (e.g., 50 people trying to buy the last out-of-stock item because Redis still says `1`).

- **Event-Driven Invalidation:** When the Inventory Service successfully commits a database update via OCC, it emits an `inventory.updated` Kafka event.
- **Cache Eviction:** A dedicated cache-invalidation consumer listens to this topic and executes a `DEL inventory:store_id:sku_id`, forcing the next read to fetch the fresh truth from PostgreSQL.

## Tradeoffs: Cache Stampede Prevention
A "Cache Stampede" occurs when a highly requested item (e.g., a Black Friday TV) expires from the cache, and 1,000 concurrent threads all hit the database simultaneously to rebuild it.

To prevent this, StoreSync uses **Jittered TTLs**. Instead of setting a hard 60-minute expiration for all keys, the TTL includes randomized jitter (e.g., `3600s ± 300s`). This ensures that bulk-loaded cache keys do not expire at the exact same millisecond. Furthermore, in future iterations, probabilistic early expiration (XFetch) can be implemented for ultra-hot SKUs.
