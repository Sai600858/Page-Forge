/**
 * run-migration.js
 * 
 * Run this ONCE to set up your Neon database tables.
 * Usage: node run-migration.js
 * 
 * Make sure DATABASE_URL is set in your .env file first.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('🚀 Running PageForge v2 database migration...\n');

  try {
    // ── Enable pgvector extension ───────────────────────────────────────────
    console.log('📦 Enabling pgvector extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('   ✅ pgvector ready\n');

    // ── Users ───────────────────────────────────────────────────────────────
    console.log('👤 Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email       TEXT UNIQUE NOT NULL,
        password    TEXT,
        name        TEXT,
        avatar      TEXT,
        google_id   TEXT UNIQUE,
        provider    TEXT DEFAULT 'email',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('   ✅ users\n');

    // ── PDF History ─────────────────────────────────────────────────────────
    console.log('📁 Creating pdf_history table...');
    await sql`
      CREATE TABLE IF NOT EXISTS pdf_history (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        filename    TEXT NOT NULL,
        operation   TEXT NOT NULL,
        file_url    TEXT,
        metadata    JSONB,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pdf_history_user_id ON pdf_history(user_id)`;
    console.log('   ✅ pdf_history\n');

    // ── Document Chunks ─────────────────────────────────────────────────────
    console.log('🔢 Creating document_chunks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        session_id   UUID,
        doc_name     TEXT NOT NULL,
        chunk_index  INTEGER NOT NULL,
        chunk_text   TEXT NOT NULL,
        embedding    vector(768),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_chunks_user_id ON document_chunks(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chunks_session_id ON document_chunks(session_id)`;
    console.log('   ✅ document_chunks\n');

    // ── Chat Sessions ───────────────────────────────────────────────────────
    console.log('💬 Creating chat_sessions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        doc_name    TEXT NOT NULL,
        messages    JSONB DEFAULT '[]'::jsonb,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)`;
    console.log('   ✅ chat_sessions\n');

    console.log('🎉 Migration complete! All tables created successfully.');
    console.log('   You can now start the backend server.\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.message.includes('pgvector')) {
      console.error('   Tip: pgvector might not be available on your Neon plan.');
      console.error('   Go to Neon dashboard → Extensions and enable pgvector.\n');
    }
    process.exit(1);
  }
}

migrate();
