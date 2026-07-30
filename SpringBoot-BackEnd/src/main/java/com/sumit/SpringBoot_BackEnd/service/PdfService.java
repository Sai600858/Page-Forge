package com.sumit.SpringBoot_BackEnd.service;

import com.sumit.SpringBoot_BackEnd.dto.PdfDtos.*;
import com.sumit.SpringBoot_BackEnd.model.entity.User;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class PdfService {

    private static final Logger log = LoggerFactory.getLogger(PdfService.class);

    private final S3Service s3Service;
    private final HistoryService historyService;

    public PdfService(S3Service s3Service, HistoryService historyService) {
        this.s3Service = s3Service;
        this.historyService = historyService;
    }

    public byte[] mergePDFs(MultipartFile[] files, User user) {
        if (files == null || files.length < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload at least 2 PDF files to merge.");
        }

        try (ByteArrayOutputStream outStream = new ByteArrayOutputStream()) {
            PDFMergerUtility pdfMerger = new PDFMergerUtility();
            pdfMerger.setDestinationStream(outStream);

            List<PDDocument> loadedDocs = new ArrayList<>();
            try {
                for (MultipartFile file : files) {
                    PDDocument doc = Loader.loadPDF(file.getBytes());
                    loadedDocs.add(doc);
                    pdfMerger.addSource(new org.apache.pdfbox.io.RandomAccessReadBuffer(file.getBytes()));
                }
                pdfMerger.mergeDocuments(null);
                byte[] mergedBytes = outStream.toByteArray();

                String firstFilename = files[0].getOriginalFilename() != null ? files[0].getOriginalFilename() : "document.pdf";
                String baseName = firstFilename.contains(".") ? firstFilename.substring(0, firstFilename.lastIndexOf(".")) : firstFilename;
                String outputFilename = baseName + "_merged.pdf";
                String s3Key = "outputs/merged-" + System.currentTimeMillis() + "-" + outputFilename;

                s3Service.uploadBufferToS3(mergedBytes, s3Key, "application/pdf");
                if (user != null) {
                    historyService.addHistoryEntry(user, outputFilename, "merge", s3Service.isS3Configured() ? s3Key : null,
                            "{\"filesCount\":" + files.length + "}");
                }

                return mergedBytes;
            } finally {
                for (PDDocument doc : loadedDocs) {
                    try { doc.close(); } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            log.error("[PdfService] Merge error: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to merge PDFs: " + e.getMessage());
        }
    }

    public Map<String, Object> splitPDF(MultipartFile file, String splitPages, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file to split.");
        }
        if (splitPages == null || splitPages.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Split page ranges (splitPages) are required.");
        }

        try (PDDocument sourcePdf = Loader.loadPDF(file.getBytes())) {
            int totalPages = sourcePdf.getNumberOfPages();
            List<int[]> ranges = parseRanges(splitPages, totalPages);

            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
            String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;

            byte[] resultData;
            String outputFilename;
            String mimeType;

            if (ranges.size() == 1) {
                int[] range = ranges.get(0);
                try (PDDocument newPdf = new PDDocument()) {
                    for (int i = range[0] - 1; i <= range[1] - 1; i++) {
                        newPdf.addPage(sourcePdf.getPage(i));
                    }
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    newPdf.save(bos);
                    resultData = bos.toByteArray();
                }
                outputFilename = baseName + "_split.pdf";
                mimeType = "application/pdf";
            } else {
                ByteArrayOutputStream zosBytes = new ByteArrayOutputStream();
                try (ZipOutputStream zos = new ZipOutputStream(zosBytes)) {
                    for (int idx = 0; idx < ranges.size(); idx++) {
                        int[] range = ranges.get(idx);
                        try (PDDocument newPdf = new PDDocument()) {
                            for (int i = range[0] - 1; i <= range[1] - 1; i++) {
                                newPdf.addPage(sourcePdf.getPage(i));
                            }
                            ByteArrayOutputStream bos = new ByteArrayOutputStream();
                            newPdf.save(bos);
                            byte[] pdfBytes = bos.toByteArray();

                            ZipEntry entry = new ZipEntry("part_" + (idx + 1) + "_pages_" + range[0] + "-" + range[1] + ".pdf");
                            zos.putNextEntry(entry);
                            zos.write(pdfBytes);
                            zos.closeEntry();
                        }
                    }
                }
                resultData = zosBytes.toByteArray();
                outputFilename = baseName + "_split.zip";
                mimeType = "application/zip";
            }

            String s3Key = "outputs/split-" + System.currentTimeMillis() + "-" + outputFilename;
            s3Service.uploadBufferToS3(resultData, s3Key, mimeType);

            if (user != null) {
                historyService.addHistoryEntry(user, outputFilename, "split", s3Service.isS3Configured() ? s3Key : null,
                        "{\"splitPages\":\"" + splitPages + "\"}");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("data", resultData);
            result.put("filename", outputFilename);
            result.put("mimeType", mimeType);
            return result;
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("[PdfService] Split error: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to split PDF: " + e.getMessage());
        }
    }

    public byte[] organizePDF(MultipartFile file, List<OperationDto> operations, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file to organize.");
        }
        if (operations == null || operations.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Operations array is required.");
        }

        try (PDDocument sourcePdf = Loader.loadPDF(file.getBytes())) {
            int totalPages = sourcePdf.getNumberOfPages();

            List<PageState> pagesState = new ArrayList<>();
            for (int i = 0; i < totalPages; i++) {
                PDPage page = sourcePdf.getPage(i);
                pagesState.add(new PageState("source", i, page.getRotation(), page.getMediaBox().getWidth(), page.getMediaBox().getHeight()));
            }

            for (OperationDto op : operations) {
                if ("delete".equalsIgnoreCase(op.getType())) {
                    if (op.getPages() != null) {
                        Set<Integer> deleteIndices = new HashSet<>();
                        for (Integer p : op.getPages()) deleteIndices.add(p - 1);
                        List<PageState> nextState = new ArrayList<>();
                        for (int idx = 0; idx < pagesState.size(); idx++) {
                            if (!deleteIndices.contains(idx)) {
                                nextState.add(pagesState.get(idx));
                            }
                        }
                        pagesState = nextState;
                    }
                } else if ("rotate".equalsIgnoreCase(op.getType())) {
                    if (op.getPage() != null && op.getAngle() != null) {
                        int idx = op.getPage() - 1;
                        if (idx >= 0 && idx < pagesState.size()) {
                            PageState ps = pagesState.get(idx);
                            ps.rotation = (ps.rotation + op.getAngle()) % 360;
                        }
                    }
                } else if ("blank".equalsIgnoreCase(op.getType())) {
                    if (op.getPage() != null) {
                        int refIdx = op.getPage() - 1;
                        int insertIdx = "after".equalsIgnoreCase(op.getPosition()) ? refIdx + 1 : refIdx;
                        float w = PDRectangle.A4.getWidth();
                        float h = PDRectangle.A4.getHeight();
                        if (refIdx >= 0 && refIdx < pagesState.size()) {
                            w = pagesState.get(refIdx).width;
                            h = pagesState.get(refIdx).height;
                        }
                        PageState blankPs = new PageState("blank", -1, 0, w, h);
                        if (insertIdx < 0) insertIdx = 0;
                        if (insertIdx > pagesState.size()) insertIdx = pagesState.size();
                        pagesState.add(insertIdx, blankPs);
                    }
                } else if ("reorder".equalsIgnoreCase(op.getType())) {
                    if (op.getOrder() != null && op.getOrder().size() == pagesState.size()) {
                        List<PageState> reordered = new ArrayList<>();
                        for (Integer pos : op.getOrder()) {
                            reordered.add(pagesState.get(pos - 1));
                        }
                        pagesState = reordered;
                    }
                }
            }

            try (PDDocument finalPdf = new PDDocument()) {
                for (PageState ps : pagesState) {
                    if ("source".equals(ps.type)) {
                        PDPage page = sourcePdf.getPage(ps.originalIndex);
                        page.setRotation(ps.rotation);
                        finalPdf.addPage(page);
                    } else if ("blank".equals(ps.type)) {
                        PDPage blankPage = new PDPage(new PDRectangle(ps.width, ps.height));
                        blankPage.setRotation(ps.rotation);
                        finalPdf.addPage(blankPage);
                    }
                }

                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                finalPdf.save(bos);
                byte[] organizedBytes = bos.toByteArray();

                String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
                String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
                String outputFilename = baseName + "_organized.pdf";
                String s3Key = "outputs/organized-" + System.currentTimeMillis() + "-" + outputFilename;

                s3Service.uploadBufferToS3(organizedBytes, s3Key, "application/pdf");
                if (user != null) {
                    historyService.addHistoryEntry(user, outputFilename, "organize", s3Service.isS3Configured() ? s3Key : null,
                            "{\"operationsCount\":" + operations.size() + "}");
                }

                return organizedBytes;
            }
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("[PdfService] Organize error: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to organize PDF: " + e.getMessage());
        }
    }

    public byte[] editPDF(MultipartFile file, List<ElementDto> elements, User user) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF file to edit.");
        }
        if (elements == null || elements.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elements array is required.");
        }

        try (PDDocument pdfDoc = Loader.loadPDF(file.getBytes())) {
            PDType1Font helveticaFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font helveticaBoldFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font timesFont = new PDType1Font(Standard14Fonts.FontName.TIMES_ROMAN);
            PDType1Font courierFont = new PDType1Font(Standard14Fonts.FontName.COURIER);

            Map<String, PDType1Font> fontMap = new HashMap<>();
            fontMap.put("helvetica", helveticaFont);
            fontMap.put("helvetica-bold", helveticaBoldFont);
            fontMap.put("times-roman", timesFont);
            fontMap.put("courier", courierFont);

            for (ElementDto el : elements) {
                int pageIndex = (el.getPage() != null ? el.getPage() : 1) - 1;
                if (pageIndex < 0 || pageIndex >= pdfDoc.getNumberOfPages()) continue;

                PDPage page = pdfDoc.getPage(pageIndex);
                float pageHeight = page.getMediaBox().getHeight();
                Color color = parseHexColor(el.getColor());

                try (PDPageContentStream contentStream = new PDPageContentStream(pdfDoc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    if ("text".equalsIgnoreCase(el.getType())) {
                        PDType1Font font = fontMap.getOrDefault(el.getFontFamily() != null ? el.getFontFamily().toLowerCase() : "helvetica", helveticaFont);
                        float fontSize = el.getFontSize() != null ? el.getFontSize() : 12f;
                        float xPdf = el.getX() != null ? el.getX() : 0f;
                        float yPdf = pageHeight - (el.getY() != null ? el.getY() : 0f) - fontSize;

                        contentStream.beginText();
                        contentStream.setFont(font, fontSize);
                        contentStream.setNonStrokingColor(color);
                        contentStream.newLineAtOffset(xPdf, yPdf);
                        contentStream.showText(el.getText() != null ? el.getText() : "");
                        contentStream.endText();
                    } else if ("image".equalsIgnoreCase(el.getType()) || "signature".equalsIgnoreCase(el.getType())) {
                        if (el.getImageBuffer() != null && !el.getImageBuffer().isEmpty()) {
                            byte[] imgBytes;
                            String dataUrl = el.getImageBuffer();
                            if (dataUrl.contains(",")) {
                                imgBytes = Base64.getDecoder().decode(dataUrl.split(",")[1]);
                            } else {
                                imgBytes = Base64.getDecoder().decode(dataUrl);
                            }

                            BufferedImage bimg = ImageIO.read(new ByteArrayInputStream(imgBytes));
                            if (bimg != null) {
                                PDImageXObject pdImage = LosslessFactory.createFromImage(pdfDoc, bimg);
                                float w = el.getWidth() != null ? el.getWidth() : pdImage.getWidth();
                                float h = el.getHeight() != null ? el.getHeight() : pdImage.getHeight();
                                float xPdf = el.getX() != null ? el.getX() : 0f;
                                float yPdf = pageHeight - (el.getY() != null ? el.getY() : 0f) - h;

                                contentStream.drawImage(pdImage, xPdf, yPdf, w, h);
                            }
                        }
                    } else if ("shape".equalsIgnoreCase(el.getType())) {
                        float thickness = el.getThickness() != null ? el.getThickness() : 2f;
                        boolean fill = Boolean.TRUE.equals(el.getFill());
                        contentStream.setStrokingColor(color);
                        contentStream.setNonStrokingColor(color);
                        contentStream.setLineWidth(thickness);

                        if ("rectangle".equalsIgnoreCase(el.getShapeType())) {
                            float w = el.getWidth() != null ? el.getWidth() : 50f;
                            float h = el.getHeight() != null ? el.getHeight() : 50f;
                            float xPdf = el.getX() != null ? el.getX() : 0f;
                            float yPdf = pageHeight - (el.getY() != null ? el.getY() : 0f) - h;

                            if (fill) {
                                contentStream.addRect(xPdf, yPdf, w, h);
                                contentStream.fill();
                            } else {
                                contentStream.addRect(xPdf, yPdf, w, h);
                                contentStream.stroke();
                            }
                        } else if ("line".equalsIgnoreCase(el.getShapeType())) {
                            float x1 = el.getX1() != null ? el.getX1() : (el.getX() != null ? el.getX() : 0f);
                            float y1 = pageHeight - (el.getY1() != null ? el.getY1() : (el.getY() != null ? el.getY() : 0f));
                            float x2 = el.getX2() != null ? el.getX2() : x1 + 50f;
                            float y2 = pageHeight - (el.getY2() != null ? el.getY2() : (el.getY() != null ? el.getY() + 50f : 50f));

                            contentStream.moveTo(x1, y1);
                            contentStream.lineTo(x2, y2);
                            contentStream.stroke();
                        }
                    }
                }
            }

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            pdfDoc.save(bos);
            byte[] editedBytes = bos.toByteArray();

            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
            String baseName = originalName.contains(".") ? originalName.substring(0, originalName.lastIndexOf(".")) : originalName;
            String outputFilename = baseName + "_edited.pdf";
            String s3Key = "outputs/edited-" + System.currentTimeMillis() + "-" + outputFilename;

            s3Service.uploadBufferToS3(editedBytes, s3Key, "application/pdf");
            if (user != null) {
                historyService.addHistoryEntry(user, outputFilename, "edit", s3Service.isS3Configured() ? s3Key : null,
                        "{\"elementsCount\":" + elements.size() + "}");
            }

            return editedBytes;
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("[PdfService] Edit error: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to edit PDF: " + e.getMessage());
        }
    }

    private List<int[]> parseRanges(String rangeStr, int totalPages) {
        List<int[]> ranges = new ArrayList<>();
        String[] parts = rangeStr.split(",");
        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            if (trimmed.contains("-")) {
                String[] bounds = trimmed.split("-");
                int start = Integer.parseInt(bounds[0].trim());
                int end = Integer.parseInt(bounds[1].trim());
                if (start < 1 || end < start || start > totalPages || end > totalPages) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid range: " + trimmed + ". Page count is " + totalPages);
                }
                ranges.add(new int[]{start, end});
            } else {
                int page = Integer.parseInt(trimmed);
                if (page < 1 || page > totalPages) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page number: " + trimmed + ". Page count is " + totalPages);
                }
                ranges.add(new int[]{page, page});
            }
        }
        if (ranges.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No valid page ranges provided.");
        }
        return ranges;
    }

    private Color parseHexColor(String hex) {
        if (hex == null || hex.trim().isEmpty()) return Color.BLACK;
        try {
            String cleaned = hex.replace("#", "");
            return new Color(
                    Integer.parseInt(cleaned.substring(0, 2), 16),
                    Integer.parseInt(cleaned.substring(2, 4), 16),
                    Integer.parseInt(cleaned.substring(4, 6), 16)
            );
        } catch (Exception e) {
            return Color.BLACK;
        }
    }

    private static class PageState {
        String type;
        int originalIndex;
        int rotation;
        float width;
        float height;

        PageState(String type, int originalIndex, int rotation, float width, float height) {
            this.type = type;
            this.originalIndex = originalIndex;
            this.rotation = rotation;
            this.width = width;
            this.height = height;
        }
    }
}
