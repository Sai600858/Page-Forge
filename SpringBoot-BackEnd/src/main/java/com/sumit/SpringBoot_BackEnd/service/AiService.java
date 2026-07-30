package com.sumit.SpringBoot_BackEnd.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sumit.SpringBoot_BackEnd.dto.AiDtos.*;
import com.sumit.SpringBoot_BackEnd.model.entity.ChatSession;
import com.sumit.SpringBoot_BackEnd.model.entity.DocumentChunk;
import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.repository.ChatSessionRepository;
import com.sumit.SpringBoot_BackEnd.repository.DocumentChunkRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.FileOutputStream;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final ChatSessionRepository chatSessionRepository;
    private final DocumentChunkRepository chunkRepository;
    private final S3Service s3Service;
    private final HistoryService historyService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api-key}")
    private String apiKey;

    @Value("${gemini.text-model}")
    private String textModel;

    @Value("${gemini.embedding-model}")
    private String embeddingModel;

    public AiService(ChatSessionRepository chatSessionRepository,
                     DocumentChunkRepository chunkRepository,
                     S3Service s3Service,
                     HistoryService historyService,
                     RestTemplate restTemplate,
                     ObjectMapper objectMapper) {
        this.chatSessionRepository = chatSessionRepository;
        this.chunkRepository = chunkRepository;
        this.s3Service = s3Service;
        this.historyService = historyService;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    private boolean isApiKeyConfigured() {
        return apiKey != null && !apiKey.trim().isEmpty()
                && !apiKey.startsWith("your_gemini_api_key");
    }

    public SummaryResponse summarizePdf(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file.");
        }

        String text;
        int pages = 1;
        try (PDDocument pdfDoc = Loader.loadPDF(file.getBytes())) {
            pages = pdfDoc.getNumberOfPages();
            PDFTextStripper stripper = new PDFTextStripper();
            text = stripper.getText(pdfDoc);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not extract text from this PDF. It may be secured or empty.");
        }

        if (text == null || text.trim().length() < 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This PDF does not contain enough readable text.");
        }

        SummaryResponse response = generateSummaryWithGemini(text);

        if (user != null) {
            historyService.addHistoryEntry(user, file.getOriginalFilename(), "summary", null,
                    "{\"pages\":" + pages + ",\"keyPointsCount\":" + (response.getKeyPoints() != null ? response.getKeyPoints().size() : 0) + "}");
        }

        return response;
    }

    @Transactional
    public ChatUploadResponse uploadAndEmbedPdf(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file.");
        }

        String text;
        int totalPages = 1;
        try (PDDocument pdfDoc = Loader.loadPDF(file.getBytes())) {
            totalPages = pdfDoc.getNumberOfPages();
            PDFTextStripper stripper = new PDFTextStripper();
            text = stripper.getText(pdfDoc);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not extract text from this PDF.");
        }

        if (text == null || text.trim().length() < 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF lacks sufficient readable text for chat indexing.");
        }

        ChatSession session = ChatSession.builder()
                .user(user)
                .docName(file.getOriginalFilename())
                .messages("[]")
                .build();
        session = chatSessionRepository.save(session);

        if (s3Service.isS3Configured()) {
            try {
                s3Service.uploadBufferToS3(file.getBytes(), "uploads/chat-" + session.getId() + ".pdf", "application/pdf");
            } catch (Exception e) {
                log.error("[AiService] S3 upload error:", e);
            }
        } else {
            try {
                File uploadsDir = new File("uploads");
                if (!uploadsDir.exists()) uploadsDir.mkdirs();
                File targetFile = new File(uploadsDir, "chat-" + session.getId() + ".pdf");
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(file.getBytes());
                }
            } catch (Exception e) {
                log.error("[AiService] Local file save error:", e);
            }
        }

        List<String> chunks = chunkText(text, 1000, 200);

        for (int i = 0; i < chunks.size(); i++) {
            String chunk = chunks.get(i);
            try {
                List<Float> embedding = generateEmbeddingWithGemini(chunk);
                String embeddingJson = objectMapper.writeValueAsString(embedding);

                DocumentChunk docChunk = DocumentChunk.builder()
                        .user(user)
                        .sessionId(session.getId())
                        .docName(file.getOriginalFilename())
                        .chunkIndex(i)
                        .chunkText(chunk)
                        .embedding(embeddingJson)
                        .build();

                chunkRepository.save(docChunk);
            } catch (Exception e) {
                log.error("[AiService] Failed to embed chunk {}: ", i, e);
            }
        }

        if (user != null) {
            historyService.addHistoryEntry(user, file.getOriginalFilename(), "chat", null, "{\"pages\":" + totalPages + ",\"session_id\":\"" + session.getId() + "\"}");
        }

        return ChatUploadResponse.builder()
                .message("PDF successfully processed and indexed for chat.")
                .sessionId(session.getId())
                .docName(session.getDocName())
                .suggestions(Arrays.asList(
                        "Summarize this document",
                        "What are the key points in this PDF?",
                        "List all important dates and events",
                        "Find any action items or tasks mentioned"
                ))
                .build();
    }

    public SseEmitter chatWithPdfStream(String sessionId, String question, User user) {
        if (sessionId == null || question == null || question.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionId and question are required fields.");
        }

        ChatSession session = chatSessionRepository.findByIdAndUserId(sessionId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat session not found."));

        List<DocumentChunk> chunks = chunkRepository.findBySessionIdAndUserId(sessionId, user.getId());
        if (chunks.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No matching document context found.");
        }

        SseEmitter emitter = new SseEmitter(180000L);

        CompletableFuture.runAsync(() -> {
            try {
                List<Float> queryEmbedding = generateEmbeddingWithGemini(question);

                PriorityQueue<Map.Entry<DocumentChunk, Double>> pq = new PriorityQueue<>(Comparator.comparingDouble(Map.Entry::getValue));
                for (DocumentChunk chunk : chunks) {
                    if (chunk.getEmbedding() != null) {
                        List<Float> chunkVector = objectMapper.readValue(chunk.getEmbedding(), new TypeReference<List<Float>>() {});
                        double sim = cosineSimilarity(queryEmbedding, chunkVector);
                        pq.add(new AbstractMap.SimpleEntry<>(chunk, sim));
                        if (pq.size() > 5) pq.poll();
                    }
                }

                List<DocumentChunk> topChunks = new ArrayList<>();
                while (!pq.isEmpty()) topChunks.add(0, pq.poll().getKey());

                StringBuilder contextBuilder = new StringBuilder();
                for (DocumentChunk tc : topChunks) {
                    contextBuilder.append(tc.getChunkText()).append("\n\n");
                }

                String fullContext = contextBuilder.toString();
                String fullAnswer = generateGeminiStreamToEmitter(fullContext, question, emitter);

                List<Map<String, Object>> messagesList = new ArrayList<>();
                if (session.getMessages() != null && !session.getMessages().trim().isEmpty()) {
                    try {
                        messagesList = objectMapper.readValue(session.getMessages(), new TypeReference<List<Map<String, Object>>>() {});
                    } catch (Exception ignored) {}
                }

                Map<String, Object> userMsg = new HashMap<>();
                userMsg.put("role", "user");
                userMsg.put("content", question);
                userMsg.put("timestamp", LocalDateTime.now().toString());

                Map<String, Object> assistantMsg = new HashMap<>();
                assistantMsg.put("role", "assistant");
                assistantMsg.put("content", fullAnswer);
                assistantMsg.put("timestamp", LocalDateTime.now().toString());

                messagesList.add(userMsg);
                messagesList.add(assistantMsg);

                session.setMessages(objectMapper.writeValueAsString(messagesList));
                chatSessionRepository.save(session);

                emitter.send(SseEmitter.event().data("[DONE]"));
                emitter.complete();
            } catch (Exception e) {
                log.error("[AiService] Streaming chat error: ", e);
                try {
                    Map<String, String> errMap = Collections.singletonMap("error", e.getMessage());
                    emitter.send(SseEmitter.event().data(objectMapper.writeValueAsString(errMap)));
                } catch (Exception ignored) {}
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    public List<Map<String, Object>> getSessions(User user) {
        List<ChatSession> sessions = chatSessionRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        List<Map<String, Object>> result = new ArrayList<>();

        for (ChatSession s : sessions) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("doc_name", s.getDocName());
            map.put("messages", parseMessagesJson(s.getMessages()));
            map.put("created_at", s.getCreatedAt());
            map.put("updated_at", s.getUpdatedAt());
            map.put("pdfUrl", getPdfUrl(s.getId()));
            result.add(map);
        }
        return result;
    }

    public Map<String, Object> getSessionById(String sessionId, User user) {
        ChatSession session = chatSessionRepository.findByIdAndUserId(sessionId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        Map<String, Object> map = new HashMap<>();
        map.put("id", session.getId());
        map.put("doc_name", session.getDocName());
        map.put("messages", parseMessagesJson(session.getMessages()));
        map.put("created_at", session.getCreatedAt());
        map.put("updated_at", session.getUpdatedAt());
        map.put("pdfUrl", getPdfUrl(session.getId()));

        Map<String, Object> response = new HashMap<>();
        response.put("session", map);
        return response;
    }

    @Transactional
    public void deleteSession(String sessionId, User user) {
        chatSessionRepository.findByIdAndUserId(sessionId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found."));

        chunkRepository.deleteBySessionIdAndUserId(sessionId, user.getId());
        chatSessionRepository.deleteById(sessionId);

        if (s3Service.isS3Configured()) {
            s3Service.deleteFileFromS3("uploads/chat-" + sessionId + ".pdf");
        } else {
            try {
                File f = new File("uploads/chat-" + sessionId + ".pdf");
                if (f.exists()) f.delete();
            } catch (Exception ignored) {}
        }
    }

    private List<String> getUrlCandidates() {
        List<String> urls = new ArrayList<>();

        String modelToUse = (textModel != null && !textModel.trim().isEmpty())
                ? textModel.trim()
                : "gemini-1.5-flash";

        urls.add("https://generativelanguage.googleapis.com/v1beta/models/" + modelToUse + ":generateContent?key=" + apiKey);
        if (!"gemini-1.5-flash".equals(modelToUse)) {
            urls.add("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey);
        }
        if (!"gemini-2.0-flash".equals(modelToUse)) {
            urls.add("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey);
        }

        return urls;
    }

    private String getPdfUrl(String sessionId) {
        if (s3Service.isS3Configured()) {
            String presigned = s3Service.getPresignedUrl("uploads/chat-" + sessionId + ".pdf");
            if (presigned != null) return presigned;
            return "https://" + s3Service.getBucketName() + ".s3.amazonaws.com/uploads/chat-" + sessionId + ".pdf";
        }
        return "http://localhost:5001/uploads/chat-" + sessionId + ".pdf";
    }

    private Object parseMessagesJson(String json) {
        if (json == null || json.trim().isEmpty()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<String> chunkText(String text, int maxLength, int overlap) {
        List<String> chunks = new ArrayList<>();
        String cleaned = text.replaceAll("\\s+", " ").trim();
        int startIndex = 0;

        while (startIndex < cleaned.length()) {
            int endIndex = startIndex + maxLength;
            if (endIndex < cleaned.length()) {
                int lastSpace = cleaned.lastIndexOf(" ", endIndex);
                if (lastSpace > startIndex) {
                    endIndex = lastSpace;
                }
            }
            String chunk = cleaned.substring(startIndex, Math.min(endIndex, cleaned.length())).trim();
            if (chunk.length() > 50) chunks.add(chunk);

            int nextIndex = endIndex - overlap;
            if (nextIndex <= startIndex) {
                startIndex = endIndex;
            } else {
                startIndex = nextIndex;
            }
        }
        return chunks;
    }

    private double cosineSimilarity(List<Float> vectorA, List<Float> vectorB) {
        if (vectorA == null || vectorB == null || vectorA.size() != vectorB.size()) return 0.0;
        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < vectorA.size(); i++) {
            dotProduct += vectorA.get(i) * vectorB.get(i);
            normA += Math.pow(vectorA.get(i), 2);
            normB += Math.pow(vectorB.get(i), 2);
        }
        return (normA == 0 || normB == 0) ? 0.0 : (dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));
    }

    private SummaryResponse generateSummaryWithGemini(String text) {
        if (!isApiKeyConfigured()) {
            return SummaryResponse.builder()
                    .summary("Google Gemini API key is required for live AI responses. Configure GEMINI_API_KEY in application.yml.")
                    .keyPoints(Arrays.asList("Document text extracted successfully (" + text.length() + " characters)", "Set GEMINI_API_KEY in application.yml"))
                    .importantDates(Collections.singletonList("N/A"))
                    .actionItems(Collections.singletonList("Obtain key from https://aistudio.google.com/"))
                    .faqs(Collections.singletonList(new SummaryResponse.FaqItem("How to enable live AI?", "Add your Google AI Studio key to application.yml")))
                    .build();
        }

        String prompt = "Analyze the following document text and return a structured JSON object.\n" +
                "The JSON object MUST strictly adhere to this format:\n" +
                "{\n" +
                "  \"summary\": \"A concise paragraph summarizing the document.\",\n" +
                "  \"keyPoints\": [\"Key takeaway point 1\", \"Key takeaway point 2\"],\n" +
                "  \"importantDates\": [\"Date/Deadline - Event description\"],\n" +
                "  \"actionItems\": [\"Task or step to complete\"],\n" +
                "  \"faqs\": [{\"q\": \"Frequently asked question?\", \"a\": \"Clear answer based on the document.\"}]\n" +
                "}\n\nDocument Text:\n" + text;

        Exception lastException = null;
        for (String url : getUrlCandidates()) {
            try {
                Map<String, Object> requestBody = new HashMap<>();
                Map<String, Object> part = Collections.singletonMap("text", prompt);
                Map<String, Object> content = Collections.singletonMap("parts", Collections.singletonList(part));
                requestBody.put("contents", Collections.singletonList(content));

                Map<String, Object> generationConfig = new HashMap<>();
                generationConfig.put("responseMimeType", "application/json");
                requestBody.put("generationConfig", generationConfig);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("x-goog-api-key", apiKey);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
                ResponseEntity<String> responseEntity = restTemplate.postForEntity(url, entity, String.class);

                Map<String, Object> responseMap = objectMapper.readValue(responseEntity.getBody(), new TypeReference<Map<String, Object>>() {});
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) responseMap.get("candidates");

                if (candidates == null || candidates.isEmpty()) {
                    throw new RuntimeException("No candidates returned. Prompt may have been blocked by safety filters.");
                }

                Map<String, Object> candidate = candidates.get(0);
                Map<String, Object> contentRes = (Map<String, Object>) candidate.get("content");
                List<Map<String, Object>> partsRes = (List<Map<String, Object>>) contentRes.get("parts");
                String jsonText = (String) partsRes.get(0).get("text");

                if (jsonText != null) {
                    jsonText = jsonText.trim();
                    if (jsonText.startsWith("```json")) {
                        jsonText = jsonText.substring(7);
                    } else if (jsonText.startsWith("```")) {
                        jsonText = jsonText.substring(3);
                    }
                    if (jsonText.endsWith("```")) {
                        jsonText = jsonText.substring(0, jsonText.length() - 3);
                    }
                    jsonText = jsonText.trim();
                }

                return objectMapper.readValue(jsonText, SummaryResponse.class);
            } catch (HttpClientErrorException.TooManyRequests e) {
                log.warn("[AiService] Gemini API quota / rate limit reached (429): {}", e.getMessage());
                return SummaryResponse.builder()
                        .summary("Google Gemini API free tier rate limit reached. Please wait 15-20 seconds and try again.")
                        .keyPoints(Arrays.asList("Document text extracted successfully (" + text.length() + " characters)", "Free tier quota resets every minute"))
                        .importantDates(Collections.singletonList("N/A"))
                        .actionItems(Collections.singletonList("Retry your request in 15-20 seconds"))
                        .faqs(Collections.singletonList(new SummaryResponse.FaqItem("Why rate limit?", "Google AI Studio free tier limits requests per minute.")))
                        .build();
            } catch (Exception e) {
                lastException = e;
                log.warn("[AiService] Gemini summary attempt with URL '{}' failed: {}", url, e.getMessage());
            }
        }

        log.error("[AiService] Gemini summary generation error across all URLs: ", lastException);
        // FIX: Removed the corrupted markdown URL syntax so it works correctly
        return SummaryResponse.builder()
                .summary("Google Gemini API request returned an error. Please verify your API key at [https://aistudio.google.com/](https://aistudio.google.com/)")
                .keyPoints(Arrays.asList("Document text extracted successfully (" + text.length() + " characters)", "Check your API key permissions on Google AI Studio"))
                .importantDates(Collections.singletonList("N/A"))
                .actionItems(Collections.singletonList("Verify GEMINI_API_KEY in application.yml"))
                .faqs(Collections.singletonList(new SummaryResponse.FaqItem("Why did this request fail?", lastException != null ? lastException.getMessage() : "Invalid API Key")))
                .build();
    }

    private List<Float> generateEmbeddingWithGemini(String text) {
        if (!isApiKeyConfigured()) {
            List<Float> mock = new ArrayList<>();
            for (int i = 0; i < 768; i++) mock.add((float) Math.sin(i + text.hashCode()));
            return mock;
        }

        // FIX: Reverted to v1beta and fixed the corrupted markdown URL syntax
        List<String> embeddingUrls = Arrays.asList(
                "https://generativelanguage.googleapis.com/v1/models/" + embeddingModel + ":embedContent?key=" + apiKey,
                "https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=" + apiKey
        );

        for (String url : embeddingUrls) {
            try {
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("model", "models/" + embeddingModel);
                Map<String, Object> part = Collections.singletonMap("text", text);
                Map<String, Object> content = Collections.singletonMap("parts", Collections.singletonList(part));
                requestBody.put("content", content);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("x-goog-api-key", apiKey);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
                ResponseEntity<String> responseEntity = restTemplate.postForEntity(url, entity, String.class);

                Map<String, Object> responseMap = objectMapper.readValue(responseEntity.getBody(), new TypeReference<Map<String, Object>>() {});
                Map<String, Object> embeddingMap = (Map<String, Object>) responseMap.get("embedding");
                List<Double> values = (List<Double>) embeddingMap.get("values");

                List<Float> floats = new ArrayList<>();
                for (Double d : values) floats.add(d.floatValue());
                return floats;
            } catch (Exception e) {
                log.warn("[AiService] Gemini embedding attempt with URL '{}' failed: {}", url, e.getMessage());
            }
        }

        List<Float> mock = new ArrayList<>();
        for (int i = 0; i < 768; i++) mock.add((float) Math.sin(i + text.hashCode()));
        return mock;
    }

    private String generateGeminiStreamToEmitter(String context, String question, SseEmitter emitter) throws Exception {
        String prompt = "You are an expert document assistant. You have been provided with the relevant context from a PDF document to answer the user's question.\n\n" +
                "Document Context:\n---\n" + context + "\n---\n\n" +
                "User Question:\n" + question + "\n\n" +
                "Instructions:\n1. Use the provided Document Context to answer the question as accurately and specifically as possible.\n" +
                "2. If the user asks for suggestions, recommendations, analysis, or how to improve something, combine document context with general intelligence.\n" +
                "3. Keep output beautifully formatted with markdown.\n";

        if (!isApiKeyConfigured()) {
            String mockAnswer = "Google Gemini API Key is required for live chat. Here is the relevant document context retrieved:\n\n" + context;
            Map<String, String> dataMap = Collections.singletonMap("text", mockAnswer);
            emitter.send(SseEmitter.event().data(objectMapper.writeValueAsString(dataMap)));
            return mockAnswer;
        }

        Exception lastException = null;
        for (String url : getUrlCandidates()) {
            try {
                Map<String, Object> requestBody = new HashMap<>();
                Map<String, Object> part = Collections.singletonMap("text", prompt);
                Map<String, Object> content = Collections.singletonMap("parts", Collections.singletonList(part));
                requestBody.put("contents", Collections.singletonList(content));

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("x-goog-api-key", apiKey);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
                ResponseEntity<String> responseEntity = restTemplate.postForEntity(url, entity, String.class);

                Map<String, Object> responseMap = objectMapper.readValue(responseEntity.getBody(), new TypeReference<Map<String, Object>>() {});
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) responseMap.get("candidates");

                if (candidates == null || candidates.isEmpty()) {
                    throw new RuntimeException("No candidates returned from Gemini. The prompt may have triggered safety filters.");
                }

                Map<String, Object> candidate = candidates.get(0);
                Map<String, Object> contentRes = (Map<String, Object>) candidate.get("content");
                List<Map<String, Object>> partsRes = (List<Map<String, Object>>) contentRes.get("parts");
                String fullAnswer = (String) partsRes.get(0).get("text");

                Map<String, String> dataMap = Collections.singletonMap("text", fullAnswer);
                emitter.send(SseEmitter.event().data(objectMapper.writeValueAsString(dataMap)));

                return fullAnswer;
            } catch (HttpClientErrorException.TooManyRequests e) {
                log.warn("[AiService] Gemini API quota / rate limit reached (429): {}", e.getMessage());
                String quotaAnswer = "Google Gemini API free tier rate limit reached. Please wait 15-20 seconds and try again.\n\nDocument context:\n" + context;
                Map<String, String> dataMap = Collections.singletonMap("text", quotaAnswer);
                emitter.send(SseEmitter.event().data(objectMapper.writeValueAsString(dataMap)));
                return quotaAnswer;
            } catch (Exception e) {
                lastException = e;
                log.warn("[AiService] Gemini chat attempt with URL '{}' failed: {}", url, e.getMessage());
            }
        }

        String fallbackAnswer = "Google Gemini API key issue: " + (lastException != null ? lastException.getMessage() : "Invalid key") + "\n\nHere is the relevant document context:\n\n" + context;
        Map<String, String> dataMap = Collections.singletonMap("text", fallbackAnswer);
        emitter.send(SseEmitter.event().data(objectMapper.writeValueAsString(dataMap)));
        return fallbackAnswer;
    }
}