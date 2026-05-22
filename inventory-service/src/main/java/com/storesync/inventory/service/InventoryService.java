package com.storesync.inventory.service;

import com.storesync.inventory.model.StoreInventory;
import com.storesync.inventory.repository.InventoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class InventoryService {

    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);
    private final InventoryRepository repository;
    private final StringRedisTemplate redisTemplate;
    private final ConcurrentHashMap<String, ReentrantLock> skuLocks = new ConcurrentHashMap<>();

    public InventoryService(InventoryRepository repository, StringRedisTemplate redisTemplate) {
        this.repository = repository;
        this.redisTemplate = redisTemplate;
    }

    private String buildCacheKey(int storeId, int skuId) {
        return "inventory:" + storeId + ":" + skuId;
    }

    private ReentrantLock getLock(int storeId, int skuId) {
        return skuLocks.computeIfAbsent(buildCacheKey(storeId, skuId), k -> new ReentrantLock());
    }

    public int getAvailableQuantity(int storeId, int skuId) {
        String cacheKey = buildCacheKey(storeId, skuId);
        String cachedValue = redisTemplate.opsForValue().get(cacheKey);
        
        if (cachedValue != null) {
            return Integer.parseInt(cachedValue);
        }

        StoreInventory inventory = repository.findByStoreIdAndSkuId(storeId, skuId)
                .orElseThrow(() -> new IllegalArgumentException("Inventory not found"));
        
        int available = inventory.getAvailableQuantity();
        redisTemplate.opsForValue().set(cacheKey, String.valueOf(available), 60, TimeUnit.SECONDS);
        return available;
    }

    @Transactional
    public boolean reserveInventory(int storeId, int skuId, int quantityToReserve) {
        ReentrantLock lock = getLock(storeId, skuId);
        
        try {
            if (!lock.tryLock(2, TimeUnit.SECONDS)) {
                log.warn("Lock timeout for store {} sku {}", storeId, skuId);
                return false;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }

        try {
            int maxRetries = 3;
            for (int i = 0; i < maxRetries; i++) {
                try {
                    StoreInventory inventory = repository.findByStoreIdAndSkuId(storeId, skuId)
                            .orElseThrow(() -> new IllegalArgumentException("Inventory not found"));

                    if (inventory.getAvailableQuantity() < quantityToReserve) {
                        return false; 
                    }

                    inventory.setReservedQuantity(inventory.getReservedQuantity() + quantityToReserve);
                    repository.save(inventory);

                    redisTemplate.delete(buildCacheKey(storeId, skuId));
                    return true;

                } catch (ObjectOptimisticLockingFailureException e) {
                    log.warn("Optimistic lock failure for store {} sku {}, retrying {}/{}", 
                            storeId, skuId, i + 1, maxRetries);
                    if (i == maxRetries - 1) throw e;
                }
            }
            return false;
        } finally {
            lock.unlock();
        }
    }
}
