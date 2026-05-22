package com.storesync.checkout.pricing;

import java.math.BigDecimal;
import java.util.Map;

// 1. Interface
public interface PricingStrategy {
    BigDecimal calculateTotal(BigDecimal basePrice);
}

// 2. Concrete Implementations
class StandardPricingStrategy implements PricingStrategy {
    @Override
    public BigDecimal calculateTotal(BigDecimal basePrice) {
        return basePrice; // No discount
    }
}

class PlusPricingStrategy implements PricingStrategy {
    @Override
    public BigDecimal calculateTotal(BigDecimal basePrice) {
        // 5% discount
        return basePrice.multiply(new BigDecimal("0.95"));
    }
}

class PremiumPricingStrategy implements PricingStrategy {
    @Override
    public BigDecimal calculateTotal(BigDecimal basePrice) {
        // 10% discount
        return basePrice.multiply(new BigDecimal("0.90"));
    }
}

// 3. Strategy Factory/Registry
class PricingStrategyRegistry {
    private final Map<String, PricingStrategy> strategies = Map.of(
        "STANDARD", new StandardPricingStrategy(),
        "PLUS", new PlusPricingStrategy(),
        "PREMIUM", new PremiumPricingStrategy()
    );

    public PricingStrategy getStrategy(String membershipTier) {
        return strategies.getOrDefault(membershipTier.toUpperCase(), strategies.get("STANDARD"));
    }
}
