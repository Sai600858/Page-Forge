// DATABASE_URL is injected by Node --env-file=.env before this module loads
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';

// Required for Neon WebSocket connection in Node.js when using Pool
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Check your backend/.env file.');
}

// Instantiate the Prisma Neon adapter with the connection options
const adapter = new PrismaNeon({ connectionString });

// Instantiate PrismaClient with the adapter
export const db = new PrismaClient({ adapter });

export default db;
