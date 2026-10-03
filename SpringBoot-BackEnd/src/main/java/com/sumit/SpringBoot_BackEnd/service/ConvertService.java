package com.sumit.SpringBoot_BackEnd.service;

import com.sumit.SpringBoot_BackEnd.model.entity.User;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class ConvertService {

    private static final Logger log = LoggerFactory.getLogger(ConvertService.class);

    private final S3Service s3Service;
    private final HistoryService historyService;

    public ConvertService(S3Service s3Service, HistoryService historyService) {
        this.s3Service = s3Service;
        this.historyService = historyService;
    }

    public byte[] wordToPdf(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a Word (.docx) file to convert.");
        }
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!originalName.toLowerCase().endsWith(".docx")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only .docx files are supported for Word to PDF conversion.");
        }

        Path tempInputDir = null;
        Path tempDocx = null;
        Path tempPdf = null;
        Path tempPs1 = null;

        try {
            tempInputDir = Files.createTempDirectory("pageforge_word_");
            tempDocx = tempInputDir.resolve("input.docx");
            file.transferTo(tempDocx.toFile());

            byte[] pdfBytes;
            boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");

            if (isWindows) {
                tempPdf = tempInputDir.resolve("output.pdf");
                tempPs1 = tempInputDir.resolve("convert.ps1");

                String escapedInput = tempDocx.toAbsolutePath().toString().replace("'", "''");
                String escapedOutput = tempPdf.toAbsolutePath().toString().replace("'", "''");

                String psScript = "\ufeff" +
                        "$ErrorActionPreference = 'Stop'\n" +
                        "$word = $null; $doc = $null\n" +
                        "try {\n" +
                        "    $word = New-Object -ComObject Word.Application\n" +
                        "    $word.Visible = $false\n" +
                        "    $word.DisplayAlerts = 0\n" +
                        "    $doc = $word.Documents.Open('" + escapedInput + "')\n" +
                        "    $doc.ExportAsFixedFormat('" + escapedOutput + "', 17)\n" +
                        "    $doc.Close($false)\n" +
                        "    $word.Quit()\n" +
                        "} finally {\n" +
                        "    if ($doc -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null }\n" +
                        "    if ($word -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }\n" +
                        "}\n";

                Files.writeString(tempPs1, psScript, StandardCharsets.UTF_8);

                ProcessBuilder pb = new ProcessBuilder("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tempPs1.toAbsolutePath().toString());
                Process process = pb.start();
                int exitCode = process.waitFor();

                if (exitCode != 0 || !Files.exists(tempPdf)) {
                    String errOutput = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                    throw new RuntimeException("PowerShell conversion failed with code " + exitCode + ": " + errOutput);
                }

                pdfBytes = Files.readAllBytes(tempPdf);
            } else {
                try {
                    ProcessBuilder pb = new ProcessBuilder("soffice", "--headless", "--convert-to", "pdf", "--outdir", tempInputDir.toAbsolutePath().toString(), tempDocx.toAbsolutePath().toString());
                    Process process = pb.start();
                    int exitCode = process.waitFor();

                    Path libreOfficeOutput = tempInputDir.resolve("input.pdf");
                    if (exitCode == 0 && Files.exists(libreOfficeOutput)) {
                        pdfBytes = Files.readAllBytes(libreOfficeOutput);
                    } else {
                        pdfBytes = convertDocxToPdfPureJava(tempDocx.toFile());
                    }
                } catch (Exception libreOfficeError) {
                    log.warn("[ConvertService] LibreOffice not available, using Pure Java fallback: {}", libreOfficeError.getMessage());
                    pdfBytes = convertDocxToPdfPureJava(tempDocx.toFile());
                }
            }

            String baseName = originalName.substring(0, originalName.lastIndexOf("."));
            String outputFilename = baseName + "_converted.pdf";
            String s3Key = "outputs/converted-" + System.currentTimeMillis() + "-" + outputFilename;

            s3Service.uploadBufferToS3(pdfBytes, s3Key, "application/pdf");
            if (user != null) {
                historyService.addHistoryEntry(user, outputFilename, "convert", s3Service.isS3Configured() ? s3Key : null, "{\"from\":\"docx\",\"to\":\"pdf\"}");
            }

            return pdfBytes;
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("[ConvertService] Word to PDF error: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to convert Word to PDF. Ensure Microsoft Word or LibreOffice is installed: " + e.getMessage());
        } finally {
            cleanupTempFiles(tempDocx, tempPdf, tempPs1, tempInputDir);
        }
    }

    public byte[] pdfToWord(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file to convert.");
        }
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!originalName.toLowerCase().endsWith(".pdf")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files are supported for PDF to Word conversion.");
        }

        try (PDDocument pdfDoc = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(pdfDoc);

            if (text == null || text.trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not extract text from this PDF. It may be encrypted or scanned images.");
            }

            try (XWPFDocument docx = new XWPFDocument(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                String[] lines = text.split("\\r?\\n");
                for (String line : lines) {
                    XWPFParagraph p = docx.createParagraph();
                    p.setSpacingAfter(120);
                    XWPFRun run = p.createRun();
                    run.setText(line);
                    run.setFontFamily("Calibri");
                    run.setFontSize(12);
                }

                docx.write(bos);
                byte[] docxBytes = bos.toByteArray();

                String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
                String outputFilename = baseName + "_converted.docx";
                String s3Key = "outputs/converted-" + System.currentTimeMillis() + "-" + outputFilename;

                s3Service.uploadBufferToS3(docxBytes, s3Key, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
                if (user != null) {
                    historyService.addHistoryEntry(user, outputFilename, "convert", s3Service.isS3Configured() ? s3Key : null, "{\"from\":\"pdf\",\"to\":\"docx\"}");
                }

                return docxBytes;
            }
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("[ConvertService] PDF to Word error: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to convert PDF to Word: " + e.getMessage());
        }
    }

    private byte[] convertDocxToPdfPureJava(File docxFile) {
        try (FileInputStream fis = new FileInputStream(docxFile);
             XWPFDocument docx = new XWPFDocument(fis);
             PDDocument pdfDoc = new PDDocument()) {

            org.apache.pdfbox.pdmodel.PDPage page = new org.apache.pdfbox.pdmodel.PDPage();
            pdfDoc.addPage(page);

            try (org.apache.pdfbox.pdmodel.PDPageContentStream contentStream =
                         new org.apache.pdfbox.pdmodel.PDPageContentStream(pdfDoc, page)) {

                contentStream.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA), 12);
                contentStream.beginText();
                contentStream.newLineAtOffset(50, 750);
                float leading = 14.5f;

                for (XWPFParagraph p : docx.getParagraphs()) {
                    String text = p.getText();
                    if (text != null && !text.trim().isEmpty()) {
                        String cleanText = text.replaceAll("[^\\x20-\\x7E]", " ");
                        contentStream.showText(cleanText);
                        contentStream.newLineAtOffset(0, -leading);
                    }
                }
                contentStream.endText();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            pdfDoc.save(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("[ConvertService] Pure Java DOCX to PDF fallback failed: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to convert Word document to PDF: " + e.getMessage());
        }
    }

    private void cleanupTempFiles(Path... paths) {
        for (Path p : paths) {
            if (p != null) {
                try { Files.deleteIfExists(p); } catch (Exception ignored) {}
            }
        }
    }
}
