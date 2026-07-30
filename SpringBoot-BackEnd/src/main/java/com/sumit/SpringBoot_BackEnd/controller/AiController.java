package com.sumit.SpringBoot_BackEnd.controller;

import com.sumit.SpringBoot_BackEnd.dto.AiDtos.*;
import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.service.AiService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/summarize")
    public ResponseEntity<SummaryResponse> summarizePdf(@RequestParam("file") MultipartFile file,
                                                        @AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        SummaryResponse response = aiService.summarizePdf(file, user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/chat/upload")
    public ResponseEntity<ChatUploadResponse> uploadAndEmbedPdf(@RequestParam("file") MultipartFile file,
                                                                @AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        ChatUploadResponse response = aiService.uploadAndEmbedPdf(file, user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/chat/message")
    public SseEmitter chatWithPdf(@RequestBody ChatMessageRequest request,
                                  @AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        return aiService.chatWithPdfStream(request.getSessionId(), request.getQuestion(), user);
    }

    @GetMapping("/chat/sessions")
    public ResponseEntity<Map<String, List<Map<String, Object>>>> getSessions(@AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        List<Map<String, Object>> sessions = aiService.getSessions(user);
        return ResponseEntity.ok(Collections.singletonMap("sessions", sessions));
    }

    @GetMapping("/chat/sessions/{id}")
    public ResponseEntity<Map<String, Object>> getSessionById(@PathVariable("id") String id,
                                                              @AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        Map<String, Object> sessionMap = aiService.getSessionById(id, user);
        return ResponseEntity.ok(sessionMap);
    }

    @DeleteMapping("/chat/sessions/{id}")
    public ResponseEntity<Map<String, String>> deleteSession(@PathVariable("id") String id,
                                                             @AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        aiService.deleteSession(id, user);
        return ResponseEntity.ok(Collections.singletonMap("message", "Session deleted successfully."));
    }
}
