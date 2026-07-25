# PageForge — AI-Powered PDF Toolkit

> A full-stack, production-grade PDF processing platform with an AI document assistant, built with React, Node.js, PostgreSQL (Neon), and AWS S3. Deployed on AWS EC2 with Docker and CI/CD via GitHub Actions.

**Live Demo:** [https://pageforge.ganeshdev.me](https://pageforge.ganeshdev.me)  
**API Base:** [https://api.pageforge.ganeshdev.me](https://api.pageforge.ganeshdev.me)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Database Schema](#database-schema)

---

## Features

### PDF Toolkit (No login required)
| Feature | Description |
|---|---|
| **Merge PDFs** | Combine multiple PDF files into one document |
| **Split PDF** | Extract specific page ranges into separate files or a ZIP archive |
| **Organize Pages** | Reorder, rotate, delete, and insert blank pages with drag-and-drop |
| **Edit PDF** | Overlay text, images, signatures, and shapes onto any PDF page |
| **Convert Word → PDF** | Convert `.docx` files to PDF using LibreOffice (Linux/Docker) |
| **Convert PDF → Word** | Extract text from a PDF and package it as a `.docx` file |
| **Protect PDF** | Password-encrypt a PDF using 256-bit AES via `qpdf` |
| **Unlock PDF** | Remove password protection from a PDF given the correct password |

### AI Features (Login required)
| Feature | Description |
|---|---|
| **PDF Summarizer** | Upload a PDF and receive a structured AI-generated summary with key points, dates, action items, and FAQs |
| **Chat with PDF** | RAG-based conversational AI — embed a PDF into a vector database and chat with it using natural language |
| **Persistent Sessions** | All chat sessions are stored in PostgreSQL and PDF files in AWS S3 |

### Authentication
- Email/password registration and login with JWT (access + refresh tokens)
- Google OAuth 2.0 via Passport.js
- HTTP-only cookie-based token storage
- Optional authentication on PDF tools (logged-in users get history tracking)

### History
- Every PDF operation is logged per-user in the database
- Output files are uploaded to S3 with 24-hour presigned download URLs
- History page displays all past operations with re-download links

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite** | Build tool and dev server |
| **React Router v6** | Client-side routing |
| **Axios** | HTTP client with cookie support |
| **TailwindCSS v4** | Utility-first CSS framework |
| **PDF.js (pdfjs-dist)** | In-browser PDF rendering for the editor canvas |
| **react-signature-canvas** | Signature drawing pad |
| **react-markdown** | Renders AI responses as formatted markdown |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 20 + Express** | REST API server |
| **Prisma ORM** | Type-safe database access |
| **Neon PostgreSQL** | Serverless Postgres with `pgvector` extension for embeddings |
| **AWS S3 SDK v3** | Cloud file storage |
| **@google/genai** | Google Gemini AI SDK (v1 stable endpoint) |
| **pdf-lib** | PDF manipulation (edit, merge, split, organize) |
| **pdf-parse** | PDF text extraction |
| **LibreOffice (soffice)** | Word-to-PDF conversion on Linux/Docker |
| **qpdf** | PDF encryption/decryption (256-bit AES) |
| **docx** | Generates Word documents for PDF-to-Word conversion |
| **Passport.js** | Google OAuth 2.0 strategy |
| **JWT (jsonwebtoken)** | Access and refresh token issuance |
| **Helmet** | HTTP security headers |
| **Multer** | Multipart file upload handling (50MB limit) |
| **bcryptjs** | Password hashing |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker** | Backend containerization |
| **Docker Hub** | Container registry |
| **AWS EC2** | Backend hosting |
| **Nginx** | Reverse proxy with SSL termination and 300s timeouts |
| **Certbot / Let's Encrypt** | HTTPS SSL certificates |
| **Vercel** | Frontend hosting with SPA rewrites |
| **GitHub Actions** | CI/CD — builds Docker image and deploys to EC2 on every push to `main` or `v2` |

---

## Project Structure

```
Page-Forge/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD: build Docker image, push to Hub, SSH deploy to EC2
├── backend/
│   ├── Dockerfile              # Node 20-slim + LibreOffice + qpdf
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma       # User, ChatSession, HistoryEntry models + pgvector
│   └── src/
│       ├── app.js              # Express app: CORS, helmet, routes, error handler
│       ├── server.js           # HTTP server entry point
│       ├── config/
│       │   ├── db.js           # Prisma client (Neon serverless adapter)
│       │   ├── env.js          # Environment variable validation
│       │   ├── jwt.js          # Token sign/verify helpers
│       │   └── passport.js     # Google OAuth strategy
│       ├── controllers/
│       │   ├── ai.controller.js       # Summarize, RAG upload, chat, sessions
│       │   ├── auth.controller.js     # Register, login, logout, refresh, me
│       │   ├── convert.controller.js  # Word→PDF, PDF→Word
│       │   ├── history.controller.js  # Get history, add entry, presigned URLs
│       │   ├── pdf.controller.js      # Merge, split, organize, edit
│       │   └── secure.controller.js   # Protect, unlock
│       ├── middleware/
│       │   ├── auth.middleware.js     # authMiddleware, optionalAuth
│       │   └── upload.middleware.js   # Multer config (50MB, PDF/DOCX/images)
│       ├── routes/
│       │   ├── ai.routes.js
│       │   ├── auth.routes.js
│       │   ├── convert.routes.js
│       │   ├── history.routes.js
│       │   ├── pdf.routes.js
│       │   └── secure.routes.js
│       └── services/
│           ├── ai.service.js          # Gemini embeddings, summary, RAG stream
│           ├── convert.service.js     # LibreOffice/PowerShell + docx builder
│           ├── edit.service.js        # pdf-lib overlay engine
│           ├── merge.service.js       # pdf-lib merge
│           ├── organize.service.js    # pdf-lib reorder/rotate/delete/blank
│           ├── s3.service.js          # S3 upload, delete, presigned URL
│           ├── secure.service.js      # qpdf encrypt/decrypt + JS fallback
│           └── split.service.js       # pdf-lib split + archiver ZIP
├── deployment/
│   └── nginx.conf              # Nginx reverse proxy template (HTTP→HTTPS, 300s timeouts)
└── frontend/
    ├── index.html
    ├── vercel.json             # SPA rewrite: all routes → index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Router + protected routes
        ├── components/
        │   ├── DropZone.jsx    # Drag-and-drop file upload
        │   ├── PageHeader.jsx  # Page title + description
        │   └── ProtectedRoute.jsx
        ├── context/
        │   └── AuthContext.jsx # Global auth state (user, login, logout)
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── EditPDF.jsx     # Full canvas editor with PDF.js rendering
        │   ├── OrganizePDF.jsx # Drag-and-drop page organizer
        │   ├── MergePDF.jsx
        │   ├── SplitPDF.jsx
        │   ├── ConvertPDF.jsx
        │   ├── SecurePDF.jsx
        │   ├── Summarize.jsx   # AI PDF summarizer
        │   ├── ChatPDF.jsx     # RAG chat interface with SSE streaming
        │   ├── History.jsx
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   └── NotFound.jsx
        └── services/
            └── api.js          # Axios instance + all API call functions
```

---

## Architecture Overview

```
Browser (React/Vite on Vercel)
        │
        │ HTTPS (VITE_API_URL)
        ▼
Nginx (EC2 — api.pageforge.ganeshdev.me)
  - SSL via Certbot / Let's Encrypt
  - client_max_body_size 100M
  - proxy timeouts 300s
        │
        │ proxy_pass → localhost:5000
        ▼
Docker Container (page-forge-backend)
  Express API (Node.js 20)
        │
        ├── Neon PostgreSQL (via Prisma + @neondatabase/serverless)
        │     - users, chat_sessions, history_entries tables
        │     - pgvector extension for document embeddings
        │
        ├── AWS S3 (page-forge-toolkit-storage)
        │     - uploads/chat-{sessionId}.pdf    (chat PDFs)
        │     - outputs/edited-{ts}-{name}.pdf  (processed output files)
        │
        └── Google Gemini API (@google/genai SDK)
              - gemini-2.0-flash    (summary + RAG chat)
              - gemini-embedding-001 (768-dim vector embeddings)
```

### Key Design Decisions

1. **Optional Auth on PDF Tools** — All core PDF operations work without login. If a JWT cookie is present, the result is logged to user history.

2. **S3 Presigned URLs** — S3 bucket is private. History entries store S3 keys, not public URLs. On history load, 24-hour presigned URLs are generated per entry. Single S3 failures don't crash the history list (wrapped in `try-catch`).

3. **Awaited History Writes** — `addHistoryEntry()` is `await`ed before sending the file response. This ensures the database record is committed before the frontend receives the download and attempts to refresh history.

4. **Streaming RAG Chat** — Gemini streams text via `generateContentStream`. The backend forwards chunks to the frontend using Server-Sent Events (SSE) with `text/event-stream`. The full response is saved to the chat session on completion.

5. **Large File Support** — Nginx allows 100MB uploads and 300s proxy timeouts. The Axios `editPDF` call has a 5-minute timeout with `maxContentLength: Infinity`.

6. **Word-to-PDF Platform Detection** — On Windows (dev), PowerShell + Microsoft Word COM automation is used. On Linux/Docker (production), LibreOffice `soffice --headless` is used.

---

## API Reference

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Create account with email + password |
| `POST` | `/login` | Public | Login, sets `access_token` + `refresh_token` cookies |
| `POST` | `/logout` | Public | Clears auth cookies |
| `POST` | `/refresh` | Public | Issues new access token from refresh token |
| `GET` | `/me` | Required | Returns current user profile |

### PDF Operations — `/api/pdf`
All endpoints accept `multipart/form-data` and support optional auth.

| Method | Endpoint | Field(s) | Description |
|---|---|---|---|
| `POST` | `/merge` | `files[]` (multiple PDFs) | Merge into one PDF |
| `POST` | `/split` | `file`, `splitPages` (e.g. `"1-3, 5"`) | Split PDF by page ranges |
| `POST` | `/organize` | `file`, `operations` (JSON array) | Reorder/rotate/delete/insert pages |
| `POST` | `/edit` | `file`, `elements` (JSON array) | Overlay text/images/shapes/signatures |

**Organize Operations Format:**
```json
[
  { "type": "reorder", "pages": [3, 1, 2] },
  { "type": "rotate", "page": 1, "degrees": 90 },
  { "type": "delete", "page": 4 },
  { "type": "blank", "afterPage": 2 }
]
```

**Edit Elements Format:**
```json
[
  { "type": "text", "page": 1, "text": "Hello", "x": 100, "y": 200, "fontSize": 14, "fontFamily": "helvetica", "color": "#000000" },
  { "type": "image", "page": 1, "imageBuffer": "data:image/png;base64,...", "x": 50, "y": 50, "width": 200, "height": 100 },
  { "type": "signature", "page": 2, "imageBuffer": "data:image/png;base64,...", "x": 300, "y": 400, "width": 150, "height": 60 },
  { "type": "shape", "page": 1, "shapeType": "rectangle", "x": 10, "y": 10, "width": 100, "height": 50, "thickness": 2, "fill": false, "color": "#ff0000" }
]
```

### Convert — `/api/convert`
| Method | Endpoint | Field | Description |
|---|---|---|---|
| `POST` | `/word-to-pdf` | `file` (.docx) | Convert Word document to PDF |
| `POST` | `/pdf-to-word` | `file` (.pdf) | Extract text and export as .docx |

### Secure — `/api/secure`
| Method | Endpoint | Fields | Description |
|---|---|---|---|
| `POST` | `/protect` | `file`, `password` | Encrypt PDF with 256-bit AES password |
| `POST` | `/unlock` | `file`, `password` | Remove PDF password protection |

### AI — `/api/ai` (Login required)
| Method | Endpoint | Fields | Description |
|---|---|---|---|
| `POST` | `/summarize` | `file` (.pdf) | Generate structured JSON summary |
| `POST` | `/chat/upload` | `file` (.pdf) | Embed PDF into vector DB, create session |
| `POST` | `/chat/message` | `sessionId`, `question` | Stream AI answer via SSE |
| `GET` | `/chat/sessions` | — | List all chat sessions |
| `GET` | `/chat/sessions/:id` | — | Get session with messages and PDF URL |
| `DELETE` | `/chat/sessions/:id` | — | Delete session + S3 PDF file |

### History — `/api/history` (Login required)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Get all history entries with S3 presigned download URLs |

---

## Environment Variables

Create `backend/.env`:

```env
# ── Server ──────────────────────────────────────────────
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://pageforge.ganeshdev.me

# ── Database (Neon PostgreSQL) ───────────────────────────
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require

# ── JWT ──────────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── AWS S3 ───────────────────────────────────────────────
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1
S3_BUCKET_NAME=page-forge-toolkit-storage

# ── Google Gemini AI ─────────────────────────────────────
GEMINI_API_KEY=AIza...

# ── Google OAuth (optional) ──────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://api.pageforge.ganeshdev.me/api/auth/google/callback
```

Create `frontend/.env`:
```env
VITE_API_URL=https://api.pageforge.ganeshdev.me
```

### AWS IAM Permissions Required

The IAM user needs the following S3 policy on `arn:aws:s3:::page-forge-toolkit-storage/*`:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject",
    "s3:DeleteObject",
    "s3:GetObjectAcl"
  ],
  "Resource": "arn:aws:s3:::page-forge-toolkit-storage/*"
}
```

---

## Local Development

### Prerequisites
- Node.js 20+
- `qpdf` installed (for PDF encryption locally)
- A Neon PostgreSQL database URL
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone and install

```bash
git clone https://github.com/blckspidey/Page-Forge.git
cd Page-Forge

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Set up database

```bash
cd backend

# Push schema to Neon
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### 3. Run development servers

```bash
# Terminal 1 — Backend (runs on port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (runs on port 5173)
cd frontend && npm run dev
```

Frontend will be at `http://localhost:5173` and proxy API calls to `http://localhost:5000`.

---

## Production Deployment

### Docker Image (Backend)

```bash
# Build image
docker build -t yourdockerhub/page-forge-backend:latest ./backend

# Push to Docker Hub
docker push yourdockerhub/page-forge-backend:latest
```

### EC2 Deployment

```bash
# On EC2 — pull and run the container
docker pull yourdockerhub/page-forge-backend:latest

docker run -d \
  --name page-forge-backend \
  -p 5000:5000 \
  --restart always \
  -v /var/www/uploads:/usr/src/app/uploads \
  --env-file /home/ubuntu/.env \
  yourdockerhub/page-forge-backend:latest
```

### Nginx Configuration (`/etc/nginx/sites-available/pageforge`)

```nginx
server {
    server_name api.pageforge.ganeshdev.me;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Large PDF processing can take minutes
        proxy_connect_timeout       300s;
        proxy_send_timeout          300s;
        proxy_read_timeout          300s;
        send_timeout                300s;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/api.pageforge.ganeshdev.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.pageforge.ganeshdev.me/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = api.pageforge.ganeshdev.me) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name api.pageforge.ganeshdev.me;
    return 404;
}
```

```bash
sudo nginx -t && sudo systemctl restart nginx
```

### Frontend (Vercel)

1. Import the GitHub repo into Vercel
2. Set root directory to `frontend`
3. Set environment variable: `VITE_API_URL=https://api.pageforge.ganeshdev.me`
4. Deploy — Vercel auto-deploys on every push to `main`

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main` or `v2`:

```
Push to v2/main
      │
      ▼
Checkout code
      │
      ▼
Build Docker image (backend/)
      │
      ▼
Push to Docker Hub (username/page-forge-backend:latest)
      │
      ▼
SSH into EC2
  - docker pull latest image
  - docker stop + rm old container
  - docker run new container with --env-file /home/ubuntu/.env
  - docker image prune -f
```

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password or access token |
| `EC2_HOST` | EC2 public IP or domain |
| `EC2_USERNAME` | SSH user (e.g. `ubuntu`) |
| `EC2_SSH_KEY` | Private SSH key (PEM format) |

---

## Database Schema

```prisma
model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  password     String?
  avatar       String?
  provider     String        @default("email")
  googleId     String?       @unique
  createdAt    DateTime      @default(now())
  chatSessions ChatSession[]
  history      HistoryEntry[]
}

model ChatSession {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String?
  messages   Json     @default("[]")
  chunks     DocumentChunk[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model DocumentChunk {
  id          String      @id @default(cuid())
  sessionId   String
  session     ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  chunkText   String
  embedding   Unsupported("vector(768)")?
  createdAt   DateTime    @default(now())
}

model HistoryEntry {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  filename  String
  operation String   // merge | split | organize | edit | convert | secure
  fileUrl   String?  // S3 key or null
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())
}
```

---

## License

MIT License — feel free to use and adapt for your own projects.

---

*Built by [Ganesh Daware](https://ganeshdev.me)*
