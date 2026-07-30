package com.sumit.SpringBoot_BackEnd.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sumit.SpringBoot_BackEnd.model.entity.PdfHistory;
import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.service.HistoryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final HistoryService historyService;
    private final ObjectMapper objectMapper;

    public HistoryController(HistoryService historyService, ObjectMapper objectMapper) {
        this.historyService = historyService;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<Map<String, List<Map<String, Object>>>> getHistory(@AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        List<PdfHistory> historyList = historyService.getUserHistory(user);
        List<Map<String, Object>> result = new ArrayList<>();

        for (PdfHistory h : historyList) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", h.getId());
            map.put("filename", h.getFilename());
            map.put("operation", h.getOperation());
            map.put("fileUrl", h.getFileUrl());
            map.put("file_url", h.getFileUrl());
            map.put("createdAt", h.getCreatedAt());
            map.put("created_at", h.getCreatedAt());

            Object metaObj = null;
            if (h.getMetadata() != null && !h.getMetadata().trim().isEmpty()) {
                try {
                    metaObj = objectMapper.readValue(h.getMetadata(), Object.class);
                } catch (Exception e) {
                    metaObj = h.getMetadata();
                }
            }
            map.put("metadata", metaObj);
            result.add(map);
        }

        return ResponseEntity.ok(Collections.singletonMap("history", result));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteHistoryEntry(@PathVariable String id, @AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        historyService.deleteHistoryEntry(id, user);
        return ResponseEntity.ok(Collections.singletonMap("message", "Entry deleted."));
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> clearHistory(@AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        historyService.clearHistory(user);
        return ResponseEntity.ok(Collections.singletonMap("message", "History cleared."));
    }
}
