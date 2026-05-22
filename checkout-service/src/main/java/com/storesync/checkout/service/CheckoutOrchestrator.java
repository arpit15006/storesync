package com.storesync.checkout.service;

import com.storesync.checkout.fraud.FraudDetectionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class CheckoutOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(CheckoutOrchestrator.class);
    private final StringRedisTemplate redisTemplate;
    private final FraudDetectionService fraudDetectionService;

    public CheckoutOrchestrator(StringRedisTemplate redisTemplate, FraudDetectionService fraudDetectionService) {
        this.redisTemplate = redisTemplate;
        this.fraudDetectionService = fraudDetectionService;
    }

    public String processCheckout(String idempotencyKey, String userId, String membershipTier) {
        String idempotencyKeyRedis = "idempotency:" + idempotencyKey;
        Boolean isFirstAttempt = redisTemplate.opsForValue().setIfAbsent(idempotencyKeyRedis, "PROCESSING", 24, TimeUnit.HOURS);
        
        if (Boolean.FALSE.equals(isFirstAttempt)) {
            log.info("Idempotent request received. Key: {}", idempotencyKey);
            return redisTemplate.opsForValue().get(idempotencyKeyRedis);
        }

        try {
            boolean isSuspicious = fraudDetectionService.isSuspiciousActivity(userId);
            fraudDetectionService.logTransactionAttempt(userId, idempotencyKey);
            
            if (isSuspicious) {
                log.warn("Suspicious activity detected for user: {}", userId);
            }

            String successResponse = "SUCCESS_RECEIPT_" + idempotencyKey;
            
            redisTemplate.opsForValue().set(idempotencyKeyRedis, successResponse, 24, TimeUnit.HOURS);
            return successResponse;

        } catch (Exception e) {
            redisTemplate.delete(idempotencyKeyRedis);
            throw new RuntimeException("Checkout failed", e);
        }
    }
}
