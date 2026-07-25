// This module MUST be imported first in db.js to ensure .env is loaded
// before any other module reads process.env
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Resolve .env from backend root (two levels up from src/config/)
config({ path: resolve(__dirname, '../../.env') });
