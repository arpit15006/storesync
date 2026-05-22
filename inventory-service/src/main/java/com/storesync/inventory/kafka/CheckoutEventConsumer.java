package com.storesync.inventory.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class CheckoutEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(CheckoutEventConsumer.class);
    private final ObjectMapper objectMapper;

    public CheckoutEventConsumer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "checkout.completed", groupId = "inventory-group")
    public void consumeCheckoutCompleted(String message) {
        try {
            JsonNode event = objectMapper.readTree(message);
            int storeId = event.get("store_id").asInt();
            int skuId = event.get("sku_id").asInt();
            int quantity = event.get("quantity").asInt();
            String checkoutId = event.get("checkout_id").asText();

            log.info("Processing checkout.completed for {} (store={}, sku={}, qty={})", 
                     checkoutId, storeId, skuId, quantity);

        } catch (Exception e) {
            log.error("Failed to process Kafka message, routing to DLQ. Message: {}", message, e);
        }
    }
}
