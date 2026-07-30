package com.sumit.SpringBoot_BackEnd.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "pdf_history", indexes = {
    @Index(name = "idx_pdf_history_user_id", columnList = "user_id")
})
public class PdfHistory {

    @Id
    @Column(columnDefinition = "VARCHAR(36)", updatable = false, nullable = false)
    private String id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String filename;

    @Column(nullable = false)
    private String operation;

    @Column(name = "file_url", length = 1000)
    private String fileUrl;

    @Column(columnDefinition = "LONGTEXT")
    private String metadata;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public PdfHistory() {}

    public PdfHistory(String id, User user, String filename, String operation, String fileUrl, String metadata, LocalDateTime createdAt) {
        this.id = id;
        this.user = user;
        this.filename = filename;
        this.operation = operation;
        this.fileUrl = fileUrl;
        this.metadata = metadata;
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

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public String getOperation() { return operation; }
    public void setOperation(String operation) { this.operation = operation; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private User user;
        private String filename;
        private String operation;
        private String fileUrl;
        private String metadata;
        private LocalDateTime createdAt;

        public Builder id(String id) { this.id = id; return this; }
        public Builder user(User user) { this.user = user; return this; }
        public Builder filename(String filename) { this.filename = filename; return this; }
        public Builder operation(String operation) { this.operation = operation; return this; }
        public Builder fileUrl(String fileUrl) { this.fileUrl = fileUrl; return this; }
        public Builder metadata(String metadata) { this.metadata = metadata; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public PdfHistory build() {
            return new PdfHistory(id, user, filename, operation, fileUrl, metadata, createdAt);
        }
    }
}
