package com.sumit.SpringBoot_BackEnd.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;

@Service
public class S3Service {

    private static final Logger log = LoggerFactory.getLogger(S3Service.class);

    @Value("${aws.s3.access-key:}")
    private String accessKey;

    @Value("${aws.s3.secret-key:}")
    private String secretKey;

    @Value("${aws.s3.region:us-east-1}")
    private String region;

    @Value("${aws.s3.bucket-name:}")
    private String bucketName;

    private S3Client s3Client;
    private S3Presigner s3Presigner;

    @PostConstruct
    public void init() {
        if (isS3Configured()) {
            try {
                AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKey, secretKey);
                Region awsRegion = Region.of(region);

                this.s3Client = S3Client.builder()
                        .region(awsRegion)
                        .credentialsProvider(StaticCredentialsProvider.create(credentials))
                        .build();

                this.s3Presigner = S3Presigner.builder()
                        .region(awsRegion)
                        .credentialsProvider(StaticCredentialsProvider.create(credentials))
                        .build();

                log.info("[S3 Service] AWS S3 Client initialized successfully for bucket: {}", bucketName);
            } catch (Exception e) {
                log.error("[S3 Service] Failed to initialize S3 Client:", e);
            }
        } else {
            log.info("[S3 Service] S3 properties not fully set. Operating in local storage mode.");
        }
    }

    public boolean isS3Configured() {
        return accessKey != null && !accessKey.trim().isEmpty() &&
               secretKey != null && !secretKey.trim().isEmpty() &&
               bucketName != null && !bucketName.trim().isEmpty();
    }

    public String getBucketName() {
        return bucketName;
    }

    public void uploadBufferToS3(byte[] buffer, String s3Key, String contentType) {
        if (!isS3Configured() || s3Client == null) return;

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3Key)
                    .contentType(contentType != null ? contentType : "application/pdf")
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromBytes(buffer));
            log.info("[S3 Service] Successfully uploaded buffer to S3: {}", s3Key);
        } catch (Exception e) {
            log.error("[S3 Service] Failed to upload buffer to S3 Key {}: ", s3Key, e);
        }
    }

    public void deleteFileFromS3(String s3Key) {
        if (!isS3Configured() || s3Client == null) return;

        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3Key)
                    .build();

            s3Client.deleteObject(deleteRequest);
            log.info("[S3 Service] Successfully deleted file from S3: {}", s3Key);
        } catch (Exception e) {
            log.error("[S3 Service] Failed to delete S3 Key {}: ", s3Key, e);
        }
    }

    public String getPresignedUrl(String s3Key) {
        if (!isS3Configured() || s3Presigner == null) return null;

        try {
            String filename = s3Key.contains("/") ? s3Key.substring(s3Key.lastIndexOf("/") + 1) : s3Key;
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofDays(1))
                    .getObjectRequest(b -> b.bucket(bucketName).key(s3Key).responseContentDisposition("attachment; filename=\"" + filename + "\""))
                    .build();

            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            log.error("[S3 Service] Failed to generate presigned URL for {}: ", s3Key, e);
            return null;
        }
    }
}
