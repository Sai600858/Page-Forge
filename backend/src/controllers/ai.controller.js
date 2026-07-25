import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { db } from '../config/db.js';
import { generateEmbeddings, generateSummary, askGeminiStream } from '../services/ai.service.js';
import { addHistoryEntry } from './history.controller.js';
import { uploadFileToS3, deleteFileFromS3, getPresignedUrl } from '../services/s3.service.js';

const getPdfUrl = async (sessionId) => {
  const isS3Configured = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
  if (isS3Configured) {
    const presigned = await getPresignedUrl(`uploads/chat-${sessionId}.pdf`);
    if (presigned) return presigned;
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/uploads/chat-${sessionId}.pdf`;
  }
  const backendUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
  return `${backendUrl}/uploads/chat-${sessionId}.pdf`;
};

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Helper to split text into overlapping chunks
 */
const chunkText = (text, maxLength = 1000, overlap = 200) => {
  const chunks = [];
  let startIndex = 0;
  
  // Clean up excessive double-newlines or spaces
  const cleanedText = text.replace(/\s+/g, ' ').trim();

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + maxLength;
    if (endIndex < cleanedText.length) {
      // Find last space to avoid cutting words
      const lastSpace = cleanedText.lastIndexOf(' ', endIndex);
      if (lastSpace > startIndex) {
        endIndex = lastSpace;
      }
    }
    
    chunks.push(cleanedText.substring(startIndex, endIndex).trim());
    startIndex = endIndex - overlap;
    
    // Safety check to prevent infinite loop
    if (overlap >= maxLength) break;
  }
  
  return chunks.filter(c => c.length > 50); // Filter out tiny chunks
};

/**
 * ─── PDF Summarizer ──────────────────────────────────────────────────────────
 */
export const summarizePdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file.' });
    }

    let text = '';
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text;
    } catch (err) {
      console.error('[Summarize] pdf-parse error:', err);
      return res.status(400).json({ error: 'Could not extract text from this PDF. It may be secured or empty.' });
    } finally {
      // Clean up uploaded file from local storage
      if (req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
    }

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'This PDF does not contain enough readable text.' });
    }

    const structuredSummary = await generateSummary(text);

    // Save operation to history
    await addHistoryEntry(req.user.id, {
      filename: req.file.originalname,
      operation: 'summary',
      metadata: {
        pages: text.split('\f').length || 1,
        keyPointsCount: structuredSummary.keyPoints?.length || 0,
      },
    });

    return res.json(structuredSummary);
  } catch (err) {
    console.error('[Summarize] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate document summary.' });
  }
};

/**
 * ─── RAG: Upload PDF and embed chunks ─────────────────────────────────────────
 */
export const uploadAndEmbedPdf = async (req, res) => {
  let fileRenamed = false;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file.' });
    }

    let text = '';
    let totalPages = 1;
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text;
      totalPages = parsed.numpages || 1;
    } catch (err) {
      console.error('[RAG Upload] pdf-parse error:', err);
      return res.status(400).json({ error: 'Could not extract text from this PDF.' });
    }

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'PDF lacks sufficient readable text for chat indexing.' });
    }

    // 1. Create a new ChatSession
    const session = await db.chatSession.create({
      data: {
        user_id: req.user.id,
        doc_name: req.file.originalname,
        messages: [],
      },
    });

    const isS3Configured = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;

    if (isS3Configured) {
      // Upload to AWS S3 for production
      try {
        await uploadFileToS3(req.file.path, `uploads/chat-${session.id}.pdf`);
      } catch (s3Err) {
        console.error('[RAG Upload] S3 upload error:', s3Err);
      }
    } else {
      // Rename locally for development
      try {
        const uploadsDir = path.dirname(req.file.path);
        const newPath = path.join(uploadsDir, `chat-${session.id}.pdf`);
        fs.renameSync(req.file.path, newPath);
        fileRenamed = true;
      } catch (renameErr) {
        console.error('[RAG Upload] Rename error:', renameErr);
      }
    }

    // 2. Chunk the text
    const textChunks = chunkText(text, 1000, 200);

    // 3. Generate embeddings & save sequentially to Neon to avoid rate limits
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      try {
        const embedding = await generateEmbeddings(chunk);
        const vectorString = `[${embedding.join(',')}]`;

        // Direct raw insert since Unsupported("vector") isn't fully query-writable in Prisma ORM
        await db.$executeRawUnsafe(
          `INSERT INTO document_chunks (user_id, session_id, doc_name, chunk_index, chunk_text, embedding) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::vector)`,
          req.user.id, session.id, req.file.originalname, i, chunk, vectorString
        );
      } catch (embErr) {
        console.error(`[RAG Upload] Failed to embed chunk ${i}:`, embErr.message);
      }
    }

    // Save operation to history
    await addHistoryEntry(req.user.id, {
      filename: req.file.originalname,
      operation: 'chat',
      metadata: {
        pages: totalPages,
        session_id: session.id,
      },
    });

    return res.json({
      message: 'PDF successfully processed and indexed for chat.',
      sessionId: session.id,
      docName: session.doc_name,
      suggestions: [
        'Summarize this document',
        'What are the key points in this PDF?',
        'List all important dates and events',
        'Find any action items or tasks mentioned',
      ],
    });
  } catch (err) {
    console.error('[RAG Upload] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process and index PDF.' });
  } finally {
    // Clean up uploaded file from local storage if it was not renamed
    if (!fileRenamed && req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
  }
};

/**
 * ─── RAG: Chat query & streaming response ──────────────────────────────────────
 */
export const chatWithPdf = async (req, res) => {
  try {
    const { sessionId, question } = req.body;
    if (!sessionId || !question) {
      return res.status(400).json({ error: 'sessionId and question are required fields.' });
    }

    // 1. Verify session exists and belongs to user
    const session = await db.chatSession.findFirst({
      where: { id: sessionId, user_id: req.user.id },
    });

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found.' });
    }

    // 2. Generate embedding for query
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbeddings(question);
    } catch (err) {
      console.error('[RAG Chat] Query embedding error:', err);
      return res.status(500).json({ error: 'Failed to process search query.' });
    }

    // 3. Find top 5 most similar chunks
    const vectorString = `[${queryEmbedding.join(',')}]`;
    const matchedChunks = await db.$queryRawUnsafe(
      `SELECT chunk_text FROM document_chunks WHERE session_id = $1::uuid AND user_id = $2::uuid ORDER BY embedding <=> $3::vector LIMIT 5`,
      sessionId, req.user.id, vectorString
    );

    if (!matchedChunks || matchedChunks.length === 0) {
      return res.status(404).json({ error: 'No matching document context found.' });
    }

    const context = matchedChunks.map(c => c.chunk_text).join('\n\n');

    // 4. Call Gemini Stream
    const stream = await askGeminiStream(context, question);

    // 5. Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullAnswer = '';

    for await (const chunk of stream) {
      const text = chunk.text;
      fullAnswer += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    // 6. Update Chat Session history
    const existingMessages = Array.isArray(session.messages) ? session.messages : [];
    const updatedMessages = [
      ...existingMessages,
      { role: 'user', content: question, timestamp: new Date().toISOString() },
      { role: 'assistant', content: fullAnswer, timestamp: new Date().toISOString() },
    ];

    await db.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: updatedMessages,
        updated_at: new Date(),
      },
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[RAG Chat] Error:', err);
    // Write the error directly to stream if it already started
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Error occurred during streaming.' })}\n\n`);
      res.end();
    } else {
      return res.status(500).json({ error: err.message || 'Failed to complete chat query.' });
    }
  }
};

/**
 * ─── RAG: List Chat Sessions ──────────────────────────────────────────────────
 */
export const getSessions = async (req, res) => {
  try {
    const sessions = await db.chatSession.findMany({
      where: { user_id: req.user.id },
      orderBy: { updated_at: 'desc' },
    });
    const sessionsWithUrls = await Promise.all(sessions.map(async (session) => ({
      ...session,
      pdfUrl: await getPdfUrl(session.id)
    })));
    return res.json({ sessions: sessionsWithUrls });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch chat sessions.' });
  }
};

/**
 * ─── RAG: Get Specific Session Messages ───────────────────────────────────────
 */
export const getSessionById = async (req, res) => {
  try {
    const session = await db.chatSession.findFirst({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    const sessionWithUrl = {
      ...session,
      pdfUrl: await getPdfUrl(session.id)
    };
    return res.json({ session: sessionWithUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve session details.' });
  }
};

/**
 * ─── RAG: Delete Session & Chunks ─────────────────────────────────────────────
 */
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Delete associated chunks
    await db.documentChunk.deleteMany({
      where: { session_id: id, user_id: req.user.id },
    });

    // 2. Delete the session
    await db.chatSession.delete({
      where: { id, user_id: req.user.id },
    });

    // 3. Delete the associated PDF file (S3 or Local)
    const isS3Configured = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
    if (isS3Configured) {
      try {
        await deleteFileFromS3(`uploads/chat-${id}.pdf`);
      } catch (s3Err) {
        console.error('[RAG Delete] S3 delete error:', s3Err);
      }
    } else {
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const filePath = path.join(__dirname, '../../uploads', `chat-${id}.pdf`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.error('[RAG Delete] File unlink error:', fileErr);
      }
    }

    return res.json({ message: 'Session deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete session.' });
  }
};
