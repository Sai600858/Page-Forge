package com.sumit.SpringBoot_BackEnd.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_chunks", indexes = {
    @Index(name = "idx_chunks_user_id", columnList = "user_id"),
    @Index(name = "idx_chunks_session_id", columnList = "session_id")
})
public class DocumentChunk {

    @Id
    @Column(columnDefinition = "VARCHAR(36)", updatable = false, nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "session_id", columnDefinition = "VARCHAR(36)", nullable = false)
    private String sessionId;

    @Column(name = "doc_name", nullable = false)
    private String docName;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(name = "chunk_text", columnDefinition = "LONGTEXT", nullable = false)
    private String chunkText;

    @Column(columnDefinition = "LONGTEXT")
    private String embedding;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public DocumentChunk() {}

    public DocumentChunk(String id, User user, String sessionId, String docName, Integer chunkIndex, String chunkText, String embedding, LocalDateTime createdAt) {
        this.id = id;
        this.user = user;
        this.sessionId = sessionId;
        this.docName = docName;
        this.chunkIndex = chunkIndex;
        this.chunkText = chunkText;
        this.embedding = embedding;
        this.createdAt = createdAt;
    }

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getDocName() { return docName; }
    public void setDocName(String docName) { this.docName = docName; }

    public Integer getChunkIndex() { return chunkIndex; }
    public void setChunkIndex(Integer chunkIndex) { this.chunkIndex = chunkIndex; }

    public String getChunkText() { return chunkText; }
    public void setChunkText(String chunkText) { this.chunkText = chunkText; }

    public String getEmbedding() { return embedding; }
    public void setEmbedding(String embedding) { this.embedding = embedding; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private User user;
        private String sessionId;
        private String docName;
        private Integer chunkIndex;
        private String chunkText;
        private String embedding;
        private LocalDateTime createdAt;

        public Builder id(String id) { this.id = id; return this; }
        public Builder user(User user) { this.user = user; return this; }
        public Builder sessionId(String sessionId) { this.sessionId = sessionId; return this; }
        public Builder docName(String docName) { this.docName = docName; return this; }
        public Builder chunkIndex(Integer chunkIndex) { this.chunkIndex = chunkIndex; return this; }
        public Builder chunkText(String chunkText) { this.chunkText = chunkText; return this; }
        public Builder embedding(String embedding) { this.embedding = embedding; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public DocumentChunk build() {
            return new DocumentChunk(id, user, sessionId, docName, chunkIndex, chunkText, embedding, createdAt);
        }
    }
}
