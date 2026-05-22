# StoreSync: Distributed Retail Systems Simulation Platform

StoreSync is a production-grade, highly concurrent distributed systems platform designed to simulate the backend architecture, inventory contention challenges, and real-time operational scale of enterprise retailers.

The architecture was explicitly engineered to align with the technical requirements of large-scale Service Oriented Architectures (SOA), focusing heavily on distributed concurrency control, massive in-memory databases, and AI/ML integrations for supply chain optimization.

## Architectural Overview

The platform decouples synchronous, high-throughput checkout workflows from downstream, asynchronous fulfillment and analytical systems using an event-driven Kafka backbone. 

- **Checkout Service (Java/Spring Boot):** The synchronous orchestrator. Handles payload validation, fraud detection integration, and emits immutable events to Kafka. Designed for sub-50ms P99 latency.
- **Inventory Service (Java/Spring Boot):** The asynchronous source of truth. Handles complex dual-tier locking (JVM ReentrantLocks + PostgreSQL Optimistic Concurrency Control) to guarantee exact-once reservation semantics under extreme contention.
- **Forecasting Pipeline (Python/FastAPI/XGBoost):** Consumes aggregated sales streams to execute batched predictions against a heavily featured XGBoost model, returning confidence-bound demand curves to optimize regional supply chain operations.
- **Operational Command Center (React/TypeScript):** A dense observability dashboard visualizing real-time Kafka throughput, consumer lag, and database conflict resolution.

## Core Engineering & Distributed Systems Principles

### High Performance, Scalable and Reliable Systems
The system is built to sustain massive concurrent bursts without dropping requests. It achieves this by shifting state mutations away from synchronous blocking REST calls into highly partitioned Apache Kafka event streams. All microservices are stateless and designed for horizontal scalability.

### Data Structures, Algorithms & Concurrency Control
Resolving inventory contention during high-velocity traffic spikes (e.g., flash sales) is handled via a dual-tier algorithmic approach:
1. **JVM-Level Lock Striping:** `ConcurrentHashMap` and `ReentrantLock` structures throttle incoming threads at the application layer, preventing database connection pool exhaustion.
2. **Optimistic Concurrency Control (OCC):** PostgreSQL `@Version` validation guarantees zero lost updates. Threads encountering `OptimisticLockException` are routed into an exponential backoff retry algorithm, ensuring eventual consistency and fault tolerance.

### Massive In-Memory Databases & Caching
To protect the primary PostgreSQL relational store, StoreSync employs a strict Read-Through caching architecture backed by Redis. This offloads >94% of read queries. Cache invalidation is handled asynchronously via Kafka consumers (`inventory.updated` topic) to prevent cache stampedes and ensure high read availability.

### AI/ML Integration
Instead of simple moving averages, the system integrates a production machine learning pipeline. It utilizes an XGBoost regressor trained on engineered time-series features (temporal lags, seasonality indicators, holiday spikes) to generate highly accurate demand forecasts, directly demonstrating the integration of ML into scalable software solutions.

## System Design Documentation

For rigorous deep dives into the engineering decisions, algorithms, and architectures used in this platform, refer to the internal documentation:

- /system-design/architecture.md
- /system-design/database-schema.md
- /system-design/concurrency-control.md
- /system-design/kafka-event-streaming.md
- /system-design/cache-strategy.md
- /ml-system-design/forecasting-pipeline.md
- /benchmarks/performance-results.md

## Tech Stack

- **Languages:** Java 21, Python 3.11, TypeScript
- **Frameworks:** Spring Boot 3, FastAPI, React
- **Distributed Infrastructure:** PostgreSQL, Apache Kafka, Zookeeper, Redis
- **Machine Learning:** XGBoost, Pandas, Scikit-Learn

## Local Execution

The entire distributed cluster can be launched locally via Docker Compose.

```bash
# 1. Start the infrastructure layer (Kafka, Zookeeper, Postgres, Redis)
docker-compose up -d

# 2. Start the Backend Microservices
cd checkout-service && mvn spring-boot:run
cd ../inventory-service && mvn spring-boot:run

# 3. Start the ML Forecasting API
cd ../forecasting-service
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 4. Start the Operational Dashboard
cd ../admin-ui && npm run dev
```
