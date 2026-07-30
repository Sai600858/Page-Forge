package com.sumit.SpringBoot_BackEnd.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sumit.SpringBoot_BackEnd.dto.PdfDtos.*;
import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.service.PdfService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pdf")
public class PdfController {

    private final PdfService pdfService;
    private final ObjectMapper objectMapper;

    public PdfController(PdfService pdfService, ObjectMapper objectMapper) {
        this.pdfService = pdfService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/merge")
    public ResponseEntity<byte[]> handleMerge(@RequestParam("files") MultipartFile[] files,
                                              @AuthenticationPrincipal User user) {
        byte[] mergedBytes = pdfService.mergePDFs(files, user);

        String firstFilename = (files != null && files.length > 0 && files[0].getOriginalFilename() != null) ? files[0].getOriginalFilename() : "document.pdf";
        String baseName = firstFilename.contains(".") ? firstFilename.substring(0, firstFilename.lastIndexOf(".")) : firstFilename;
        String outputFilename = baseName + "_merged.pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .body(mergedBytes);
    }

    @PostMapping("/split")
    public ResponseEntity<byte[]> handleSplit(@RequestParam("file") MultipartFile file,
                                              @RequestParam("splitPages") String splitPages,
                                              @AuthenticationPrincipal User user) {
        Map<String, Object> result = pdfService.splitPDF(file, splitPages, user);
        byte[] data = (byte[]) result.get("data");
        String filename = (String) result.get("filename");
        String mimeType = (String) result.get("mimeType");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, mimeType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(data);
    }

    @PostMapping("/organize")
    public ResponseEntity<byte[]> handleOrganize(@RequestParam("file") MultipartFile file,
                                                 @RequestParam("operations") String operationsJson,
                                                 @AuthenticationPrincipal User user) throws Exception {
        List<OperationDto> operations = objectMapper.readValue(operationsJson, new TypeReference<List<OperationDto>>() {});
        byte[] organizedBytes = pdfService.organizePDF(file, operations, user);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
        String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
        String outputFilename = baseName + "_organized.pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .body(organizedBytes);
    }

    @PostMapping("/edit")
    public ResponseEntity<byte[]> handleEdit(@RequestParam("file") MultipartFile file,
                                             @RequestParam("elements") String elementsJson,
                                             @AuthenticationPrincipal User user) throws Exception {
        List<ElementDto> elements = objectMapper.readValue(elementsJson, new TypeReference<List<ElementDto>>() {});
        byte[] editedBytes = pdfService.editPDF(file, elements, user);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
        String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
        String outputFilename = baseName + "_edited.pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .body(editedBytes);
    }
}
