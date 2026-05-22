package com.storesync.inventory.repository;

import com.storesync.inventory.model.StoreInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<StoreInventory, Long> {
    Optional<StoreInventory> findByStoreIdAndSkuId(Integer storeId, Integer skuId);
}
