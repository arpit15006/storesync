# Workload Modeling & Simulation

To prove the efficacy of StoreSync's backend architecture, the system is subjected to aggressive workload modeling that mimics real-world enterprise retail conditions.

## Traffic Simulation Strategy

Workloads are modeled using JMeter and custom Python multiprocessing scripts to generate sustained API traffic against the Checkout Service.

### Peak Traffic Assumptions
- **Sustained Load:** 1,200 Requests Per Second (RPS) representing normal global retail traffic.
- **Burst Load (Black Friday):** 5,000+ RPS targeted at a highly constrained subset of SKUs (10-15 "hot" items) to explicitly trigger inventory contention and force the optimistic locking mechanism to resolve race conditions.

## Contention & Collision Modeling

The primary metric of success is not just raw throughput, but **Reservation Accuracy**. 
When 5,000 concurrent threads attempt to purchase 100 available PS5s:
1. The cache will correctly allow the first ~150 requests through.
2. The JVM `ReentrantLock` will throttle the requests.
3. The PostgreSQL `@Version` column will accept exactly 100 commits and throw `OptimisticLockException` on the rest.
4. The system guarantees 0 lost updates and 0 negative inventory balances.

## Latency Benchmarking
Latency is measured at the P50, P90, and P99 percentiles. 
- The synchronous Checkout API aims for a strict < 50ms P99 latency.
- Database locks, synchronous external API calls (Fraud detection), and heavy parsing are rigorously avoided in the primary thread path to maintain this SLA.

By pushing the system to failure, the workload models prove that StoreSync degrades gracefully (buffering in Kafka, queuing retries) rather than catastrophically failing under load.
