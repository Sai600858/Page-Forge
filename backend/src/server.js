import app from './app.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 5001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

// Cleanup daemon for stranded temporary files (e.g. from crashed sessions)
const cleanupOldFiles = () => {
  if (!fs.existsSync(uploadDir)) return;

  fs.readdir(uploadDir, (err, files) => {
    if (err) return console.error('Cleanup readdir error:', err);

    const now = Date.now();
    const ageLimit = 60 * 60 * 1000; // 1 hour

    files.forEach((file) => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > ageLimit) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to cleanup old file ${filePath}:`, err);
            else console.log(`[CLEANUP] Deleted stranded temporary file: ${file}`);
          });
        }
      });
    });
  });
};

// Start server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`  PAGE FORGE Backend Server      `);
  console.log(`  Listening on port: ${PORT}     `);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=================================`);

  // Run cleanup once on startup, then every 30 minutes
  cleanupOldFiles();
  setInterval(cleanupOldFiles, 30 * 60 * 1000);
});

// Trigger reload with real Gemini API key configured.

