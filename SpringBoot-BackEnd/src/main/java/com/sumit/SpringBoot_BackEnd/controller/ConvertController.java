package com.sumit.SpringBoot_BackEnd.controller;

import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.service.ConvertService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/convert")
public class ConvertController {

    private final ConvertService convertService;

    public ConvertController(ConvertService convertService) {
        this.convertService = convertService;
    }

    @PostMapping("/word-to-pdf")
    public ResponseEntity<byte[]> handleWordToPdf(@RequestParam("file") MultipartFile file,
                                                  @AuthenticationPrincipal User user) {
        byte[] pdfBytes = convertService.wordToPdf(file, user);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.docx";
        String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
        String outputFilename = baseName + "_converted.pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .body(pdfBytes);
    }

    @PostMapping("/pdf-to-word")
    public ResponseEntity<byte[]> handlePdfToWord(@RequestParam("file") MultipartFile file,
                                                  @AuthenticationPrincipal User user) {
        byte[] docxBytes = convertService.pdfToWord(file, user);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
        String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
        String outputFilename = baseName + "_converted.docx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .body(docxBytes);
    }
}
