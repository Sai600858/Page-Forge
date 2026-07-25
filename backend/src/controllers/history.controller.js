import { db } from '../config/db.js';
import { getPresignedUrl, isS3Configured } from '../services/s3.service.js';

// ─── Get User History ─────────────────────────────────────────────────────────
export const getHistory = async (req, res) => {
  try {
    const history = await db.pdfHistory.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
      take: 100
    });

    const s3Active = isS3Configured();

    const historyWithUrls = await Promise.all(history.map(async (entry) => {
      let fileUrl = entry.file_url;
      // If S3 is active and the stored file_url is a relative S3 key (doesn't start with http/https)
      if (s3Active && fileUrl && !fileUrl.startsWith('http')) {
        try {
          const presigned = await getPresignedUrl(fileUrl);
          if (presigned) fileUrl = presigned;
        } catch (_) {
          // Non-critical: fall back to raw key if presigning fails
        }
      }
      return { ...entry, file_url: fileUrl };
    }));

    return res.json({ history: historyWithUrls });
  } catch (err) {
    console.error('[History] getHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
};

// ─── Add History Entry (internal helper) ────────────────────────────────────
export const addHistoryEntry = async (userId, { filename, operation, fileUrl, metadata }) => {
  try {
    await db.pdfHistory.create({
      data: {
        user_id: userId,
        filename,
        operation,
        file_url: fileUrl,
        metadata: metadata || {}
      }
    });
  } catch (err) {
    // Non-critical — log but don't throw
    console.error('[History] Failed to log entry:', err.message);
  }
};

// ─── Delete Single History Entry ─────────────────────────────────────────────
export const deleteHistoryEntry = async (req, res) => {
  try {
    const { id } = req.params;
    await db.pdfHistory.delete({
      where: { id }
    });

    return res.json({ message: 'Entry deleted.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete entry.' });
  }
};

// ─── Clear All History ────────────────────────────────────────────────────────
export const clearHistory = async (req, res) => {
  try {
    await db.pdfHistory.deleteMany({
      where: { user_id: req.user.id }
    });
    return res.json({ message: 'History cleared.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear history.' });
  }
};
