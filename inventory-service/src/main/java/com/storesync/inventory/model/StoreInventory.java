package com.storesync.inventory.model;

import jakarta.persistence.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "store_inventory", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"store_id", "sku_id"})
})
public class StoreInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Integer storeId;

    @Column(name = "sku_id", nullable = false)
    private Integer skuId;

    @Column(name = "total_quantity", nullable = false)
    private Integer totalQuantity;

    @Column(name = "reserved_quantity", nullable = false)
    private Integer reservedQuantity;

    @UpdateTimestamp
    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    @Version
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getStoreId() { return storeId; }
    public void setStoreId(Integer storeId) { this.storeId = storeId; }
    public Integer getSkuId() { return skuId; }
    public void setSkuId(Integer skuId) { this.skuId = skuId; }
    public Integer getTotalQuantity() { return totalQuantity; }
    public void setTotalQuantity(Integer totalQuantity) { this.totalQuantity = totalQuantity; }
    public Integer getReservedQuantity() { return reservedQuantity; }
    public void setReservedQuantity(Integer reservedQuantity) { this.reservedQuantity = reservedQuantity; }
    public LocalDateTime getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    @Transient
    public Integer getAvailableQuantity() {
        return totalQuantity - reservedQuantity;
    }
}
