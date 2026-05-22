# Observability & Monitoring

A distributed system is inherently a black box without rigorous observability. StoreSync emphasizes operational visibility across the entire stack, utilizing Prometheus for metric scraping and customized Grafana/React dashboards for visualization.

## Core Telemetry Metrics

### 1. API Latency & Throughput
- **Throughput:** Tracked as Requests Per Second (RPS) on the Checkout Orchestrator.
- **P99 Latency:** Crucial for identifying garbage collection pauses or database connection pool exhaustion. The system strictly monitors the 99th percentile response time to guarantee SLA compliance.

### 2. Concurrency & Locking
- **Active Threads:** The number of concurrent JVM threads holding `ReentrantLocks`.
- **Reservation Success Rate:** The ratio of successful database commits vs. `OptimisticLockExceptions`. A spike in exceptions directly correlates to high inventory contention (e.g., a flash sale).

### 3. Kafka Health
- **Consumer Lag:** The delta between the latest offset produced by Checkout and the latest offset committed by Inventory. If this number grows beyond 0, the Inventory service is falling behind real-time.
- **Dead Letter Queue (DLQ) Volume:** Monitors events that failed processing. Any value > 0 triggers an immediate pager alert for engineering intervention.

### 4. Cache Performance
- **Cache Hit Rate:** The percentage of read queries served by Redis vs PostgreSQL. StoreSync targets a > 95% cache hit rate to preserve database I/O for writes.

## Failure Recovery Monitoring
StoreSync explicitly tracks the **Recovery Success Rate**—the percentage of failed transactions (due to OCC lock collisions or transient network timeouts) that were successfully resolved via the exponential backoff retry queue without user intervention or data loss.
