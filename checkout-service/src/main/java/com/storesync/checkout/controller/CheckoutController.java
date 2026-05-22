package com.storesync.checkout.controller;

import com.storesync.checkout.service.CheckoutOrchestrator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/checkout")
public class CheckoutController {

    private final CheckoutOrchestrator orchestrator;

    public CheckoutController(CheckoutOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> processCheckout(@RequestBody Map<String, Object> request) {
        String idempotencyKey = (String) request.getOrDefault("idempotencyKey", UUID.randomUUID().toString());
        String userId = (String) request.getOrDefault("userId", "anonymous");
        String membershipTier = (String) request.getOrDefault("membershipTier", "standard");

        try {
            String receipt = orchestrator.processCheckout(idempotencyKey, userId, membershipTier);
            return ResponseEntity.ok(Map.of("status", "SUCCESS", "receipt", receipt));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("status", "FAILED", "error", e.getMessage()));
        }
    }
}
