package com.sumit.SpringBoot_BackEnd.service;

import com.sumit.SpringBoot_BackEnd.model.entity.PdfHistory;
import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.repository.PdfHistoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class HistoryService {

    private static final Logger log = LoggerFactory.getLogger(HistoryService.class);

    private final PdfHistoryRepository historyRepository;
    private final S3Service s3Service;

    public HistoryService(PdfHistoryRepository historyRepository, S3Service s3Service) {
        this.historyRepository = historyRepository;
        this.s3Service = s3Service;
    }

    public void addHistoryEntry(User user, String filename, String operation, String fileUrl, String metadata) {
        if (user == null) return;

        try {
            PdfHistory entry = PdfHistory.builder()
                    .user(user)
                    .filename(filename)
                    .operation(operation)
                    .fileUrl(fileUrl)
                    .metadata(metadata)
                    .build();

            historyRepository.save(entry);
        } catch (Exception e) {
            log.error("[HistoryService] Failed to log history entry:", e);
        }
    }

    public List<PdfHistory> getUserHistory(User user) {
        List<PdfHistory> history = historyRepository.findTop100ByUserIdOrderByCreatedAtDesc(user.getId());

        boolean s3Active = s3Service.isS3Configured();
        for (PdfHistory entry : history) {
            String url = entry.getFileUrl();
            if (s3Active && url != null && !url.startsWith("http")) {
                String presigned = s3Service.getPresignedUrl(url);
                if (presigned != null) {
                    entry.setFileUrl(presigned);
                }
            }
        }
        return history;
    }

    @Transactional
    public void deleteHistoryEntry(String id, User user) {
        PdfHistory entry = historyRepository.findById(id).orElse(null);
        if (entry != null && entry.getUser().getId().equals(user.getId())) {
            historyRepository.delete(entry);
        }
    }

    @Transactional
    public void clearHistory(User user) {
        historyRepository.deleteByUserId(user.getId());
    }
}
