# Kafka Event Replay Engine

StoreSync includes a dedicated Event Replay pipeline designed to stream massive datasets of synthetic historical transactions through the live Kafka infrastructure.

## Replay Engine Architecture

Unlike batch loading data directly into PostgreSQL, the Replay Engine reads the synthetic CSV datasets and publishes them directly to the `checkout.completed` Kafka topic in high-speed, parallel batches.

### Why Replay over Direct Inserts?
1. **End-to-End Testing:** It tests the entire asynchronous pipeline, ensuring the Kafka brokers can handle sustained multi-megabyte-per-second throughput without dropping events.
2. **Consumer Group Benchmarking:** It allows engineers to measure consumer lag and tune the `max.poll.records` and `fetch.min.bytes` configurations of the Inventory and ML consumers.
3. **State Recreation:** In a production disaster recovery scenario, if the primary database is lost, the system can rebuild its entire state by simply resetting the Kafka consumer offsets to 0 and replaying the immutable event log.

## Event Scheduling & Throughput
The replay engine uses Python's `confluent_kafka` library, configured with aggressive asynchronous batching (`linger.ms` and `batch.size`) to maximize throughput. It can simulate a full month of historical enterprise sales data in a matter of minutes, triggering massive concurrent load on the downstream microservices.
