import json
import time
import uuid
import random
from datetime import datetime, timezone
from kafka import KafkaProducer
import sys

KAFKA_BROKER = 'localhost:29092'
TOPIC = 'checkout.completed'

# Configuration for workload simulation
TPS_TARGET = 50  # Transactions per second baseline
NUM_STORES = 10
NUM_SKUS = 200

def create_producer():
    try:
        producer = KafkaProducer(
            bootstrap_servers=[KAFKA_BROKER],
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8')
        )
        return producer
    except Exception as e:
        print(f"Failed to connect to Kafka: {e}")
        sys.exit(1)

def generate_checkout_event():
    store_id = random.randint(1, NUM_STORES)
    sku_id = random.randint(1, NUM_SKUS)
    # Simulate high contention occasionally (e.g., SKU 42 is going viral)
    if random.random() < 0.1:
        sku_id = 42
        
    return {
        "event_id": str(uuid.uuid4()),
        "checkout_id": f"chk_{uuid.uuid4().hex[:8]}",
        "store_id": store_id,
        "sku_id": sku_id,
        "quantity": random.randint(1, 3),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payment_status": "SUCCESS"
    }

def generate_fraud_burst_events(user_id, count=15):
    # Generates a rapid burst of transactions to test sliding window
    events = []
    for _ in range(count):
        events.append({
            "event_id": str(uuid.uuid4()),
            "checkout_id": f"chk_fraud_{uuid.uuid4().hex[:8]}",
            "store_id": random.randint(1, NUM_STORES),
            "sku_id": random.randint(1, NUM_SKUS),
            "quantity": 1,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payment_status": "SUCCESS",
            "user_id": user_id
        })
    return events

def main():
    print("Starting Kafka Event Replay Simulation...")
    producer = create_producer()
    print(f"Connected to Kafka broker at {KAFKA_BROKER}")
    
    count = 0
    try:
        while True:
            # Randomly trigger a fraud burst
            if random.random() < 0.005:
                print("\n[!] Simulating rapid checkout burst (fraud pattern)...")
                fraud_events = generate_fraud_burst_events(user_id=f"user_{random.randint(1,1000)}")
                for event in fraud_events:
                    producer.send(TOPIC, key=str(event['store_id']), value=event)
                producer.flush()
                print("Burst sent.")
            
            event = generate_checkout_event()
            # Key by store_id ensures strict ordering per store partition
            producer.send(TOPIC, key=str(event['store_id']), value=event)
            count += 1
            
            if count % 100 == 0:
                print(f"Sent {count} events...")
                
            # Sleep to maintain target TPS
            time.sleep(1.0 / TPS_TARGET)
            
    except KeyboardInterrupt:
        print("\nSimulation stopped.")
    finally:
        producer.flush()
        producer.close()

if __name__ == "__main__":
    main()
