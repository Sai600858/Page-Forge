package com.sumit.SpringBoot_BackEnd.controller;

import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.service.SecureService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/secure")
public class SecureController {

    private final SecureService secureService;

    public SecureController(SecureService secureService) {
        this.secureService = secureService;
    }

    @PostMapping("/protect")
    public ResponseEntity<byte[]> handleProtect(@RequestParam("file") MultipartFile file,
                                                 @RequestParam("password") String password,
                                                 @AuthenticationPrincipal User user) {
        byte[] protectedBytes = secureService.protectPDF(file, password, user);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
        String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
        String outputFilename = baseName + "_secured.pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .body(protectedBytes);
    }

    @PostMapping("/unlock")
    public ResponseEntity<byte[]> handleUnlock(@RequestParam("file") MultipartFile file,
                                                @RequestParam("password") String password,
                                                @AuthenticationPrincipal User user) {
        byte[] unlockedBytes = secureService.unlockPDF(file, password, user);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
        String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
        String outputFilename = baseName + "_unlocked.pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .body(unlockedBytes);
    }
}
