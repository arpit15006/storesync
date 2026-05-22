package com.storesync.checkout.fraud;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

@Service
public class FraudDetectionService {

    private final StringRedisTemplate redisTemplate;
    
    private static final int WINDOW_MINUTES = 5;
    private static final int THRESHOLD = 10;

    public FraudDetectionService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

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
}
