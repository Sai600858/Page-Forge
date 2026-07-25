import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';

export const isS3Configured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME &&
    process.env.AWS_REGION
  );
};

let s3Client = null;
if (isS3Configured()) {
  try {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    console.log('[S3 Service] AWS S3 Client initialized successfully.');
  } catch (err) {
    console.error('[S3 Service] Failed to initialize S3 Client:', err);
  }
} else {
  console.log('[S3 Service] S3 environment variables not set. Running in local storage mode.');
}

/**
 * Uploads a local file to the specified S3 bucket path
 * @param {string} localFilePath - Path to the file on local disk
 * @param {string} s3Key - S3 destination path (e.g. 'uploads/file-name.pdf')
 */
export const uploadFileToS3 = async (localFilePath, s3Key) => {
  if (!s3Client) return;

  try {
    if (!fs.existsSync(localFilePath)) {
      console.warn(`[S3 Service] File does not exist at path: ${localFilePath}`);
      return;
    }

    const fileStream = fs.createReadStream(localFilePath);
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: s3Key.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
    });

    await s3Client.send(command);
    console.log(`[S3 Service] Successfully uploaded file to S3: ${s3Key}`);
  } catch (err) {
    console.error(`[S3 Service] Failed to upload ${localFilePath} to S3 Key ${s3Key}:`, err);
  }
};

/**
 * Uploads a buffer directly to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} s3Key - S3 destination path
 * @param {string} contentType - MimeType of file
 */
export const uploadBufferToS3 = async (buffer, s3Key, contentType = 'application/pdf') => {
  if (!s3Client) return;

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`[S3 Service] Successfully uploaded buffer to S3: ${s3Key}`);
  } catch (err) {
    console.error(`[S3 Service] Failed to upload buffer to S3 Key ${s3Key}:`, err);
  }
};

/**
 * Deletes a file from the specified S3 bucket path
 * @param {string} s3Key - S3 file path (e.g. 'uploads/file-name.pdf')
 */
export const deleteFileFromS3 = async (s3Key) => {
  if (!s3Client) return;

  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);
    console.log(`[S3 Service] Successfully deleted file from S3: ${s3Key}`);
  } catch (err) {
    console.error(`[S3 Service] Failed to delete S3 Key ${s3Key}:`, err);
  }
};

/**
 * Generates a temporary presigned URL for an S3 object
 * @param {string} s3Key - S3 destination path
 * @param {number} expiresInSeconds - Expiration time in seconds (default 1 day)
 * @returns {Promise<string|null>}
 */
export const getPresignedUrl = async (s3Key, expiresInSeconds = 86400) => {
  if (!s3Client) return null;
  try {
    const filename = s3Key.split('/').pop() || 'document.pdf';
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${filename}"`
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return url;
  } catch (err) {
    console.error(`[S3 Service] Failed to generate presigned URL for ${s3Key}:`, err);
    return null;
  }
};

