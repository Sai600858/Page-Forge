package com.sumit.SpringBoot_BackEnd.service;

import com.sumit.SpringBoot_BackEnd.model.entity.User;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;

@Service
public class SecureService {

    private static final Logger log = LoggerFactory.getLogger(SecureService.class);

    private final S3Service s3Service;
    private final HistoryService historyService;

    public SecureService(S3Service s3Service, HistoryService historyService) {
        this.s3Service = s3Service;
        this.historyService = historyService;
    }

    public byte[] protectPDF(MultipartFile file, String password, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file to encrypt.");
        }
        if (password == null || password.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required to secure PDF.");
        }

        try (PDDocument doc = Loader.loadPDF(file.getBytes())) {
            AccessPermission ap = new AccessPermission();
            StandardProtectionPolicy spp = new StandardProtectionPolicy(password, password, ap);
            spp.setEncryptionKeyLength(128);

            doc.protect(spp);

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            doc.save(bos);
            byte[] protectedBytes = bos.toByteArray();

            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
            String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
            String outputFilename = baseName + "_secured.pdf";
            String s3Key = "outputs/secured-" + System.currentTimeMillis() + "-" + outputFilename;

            s3Service.uploadBufferToS3(protectedBytes, s3Key, "application/pdf");
            if (user != null) {
                historyService.addHistoryEntry(user, outputFilename, "secure", s3Service.isS3Configured() ? s3Key : null, "{\"action\":\"protect\"}");
            }

            return protectedBytes;
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("[SecureService] Protect error: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to secure PDF: " + e.getMessage());
        }
    }

    public byte[] unlockPDF(MultipartFile file, String password, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file to unlock.");
        }
        if (password == null || password.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required to decrypt PDF.");
        }

        try (PDDocument doc = Loader.loadPDF(file.getBytes(), password)) {
            doc.setAllSecurityToBeRemoved(true);

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            doc.save(bos);
            byte[] unlockedBytes = bos.toByteArray();

            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
            String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
            String outputFilename = baseName + "_unlocked.pdf";
            String s3Key = "outputs/unlocked-" + System.currentTimeMillis() + "-" + outputFilename;

            s3Service.uploadBufferToS3(unlockedBytes, s3Key, "application/pdf");
            if (user != null) {
                historyService.addHistoryEntry(user, outputFilename, "secure", s3Service.isS3Configured() ? s3Key : null, "{\"action\":\"unlock\"}");
            }

            return unlockedBytes;
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("[SecureService] Unlock error: ", e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incorrect password or failed to decrypt PDF.");
        }
    }
}
