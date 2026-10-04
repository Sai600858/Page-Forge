# PageForge — AI-Powered PDF Toolkit

> A full-stack, production-grade PDF processing platform with an AI document assistant, built with React, Spring Boot 3.3.0 (Java 21), MySQL, and AWS S3. Deployed on AWS EC2 with Docker and CI/CD via GitHub Actions.

### 🚀 Live Demo

🔗 **[Visit PageForge](https://page-forge-zeta.vercel.app)**

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

---

## Features

### PDF Toolkit (No login required)
| Feature | Description |
|---|---|
| **Merge PDFs** | Combine multiple PDF files into one document using Apache PDFBox |
| **Split PDF** | Extract specific page ranges into separate files or a ZIP archive |
| **Organize Pages** | Reorder, rotate, delete, and insert blank pages with drag-and-drop |
| **Edit PDF** | Overlay text, images, signatures, and shapes onto any PDF page |
| **Convert Word → PDF** | Convert `.docx` files to PDF using Apache POI & PDFBox |
| **Convert PDF → Word** | Extract text from a PDF and package it as a `.docx` file using Apache POI |
| **Protect PDF** | Password-encrypt a PDF using 256-bit AES encryption |
| **Unlock PDF** | Remove password protection from a PDF given the correct password |

### AI Features (Login required)
| Feature | Description |
|---|---|
| **PDF Summarizer** | Upload a PDF and receive a structured AI-generated summary with key points, dates, action items, and FAQs |
| **Chat with PDF** | RAG-based conversational AI — embed a PDF into vector representations and chat with it using natural language |
| **Persistent Sessions** | All chat sessions are stored in MySQL database and PDF files in AWS S3 |

### Authentication
- Email/password registration and login with JWT (access + refresh tokens)
- Spring Security integration
- Standardized Bearer token & HTTP-only authorization headers
- Optional authentication on PDF tools (logged-in users get operation history tracking)

### History
- Every PDF operation is logged per-user in MySQL database
- Output files are stored in S3 (or local disk mode) with presigned download links
- History page displays all past operations with re-download links

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite** | Build tool and dev server |
| **React Router v6** | Client-side routing |
| **Axios** | HTTP client with authentication support |
| **TailwindCSS v4** | Utility-first CSS framework |
| **PDF.js (pdfjs-dist)** | In-browser PDF rendering for editor canvas |
| **react-signature-canvas** | Signature drawing pad |
| **react-markdown** | Renders AI responses as formatted markdown |
| **Lucide React** | Icon library |

### Backend (SpringBoot-BackEnd)
| Technology | Purpose |
|---|---|
| **Spring Boot 3.3.0 + Java 21** | REST API server & enterprise application framework |
| **Spring Data JPA / Hibernate** | Type-safe ORM & database management |
| **MySQL** | Relational database storage |
| **Spring Security** | Authentication & authorization framework |
| **JJWT (io.jsonwebtoken)** | JWT access and refresh token issuance & validation |
| **Apache PDFBox 3.0.2** | PDF manipulation (edit, merge, split, organize, protect, unlock) |
| **Apache POI 5.2.5** | Word document creation and text extraction |
| **AWS SDK for Java 2.x** | AWS S3 Cloud file storage integration |
| **Google Gemini API** | AI embeddings (`text-embedding-004`) and text generation (`gemini-3.5-flash`) |
| **Lombok** | Boilerplate code reduction |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker** | Spring Boot containerization |
| **Docker Hub** | Container registry |
| **AWS EC2** | Backend hosting |
| **Nginx** | Reverse proxy with SSL termination (port 5001) |
| **Certbot / Let's Encrypt** | HTTPS SSL certificates |
| **Vercel** | Frontend hosting with SPA rewrites |
| **GitHub Actions** | CI/CD — builds Spring Boot Docker image and deploys to EC2 on push |

---

## Project Structure

```
Page-Forge/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD: build Docker image, push to Hub, SSH deploy to EC2
├── SpringBoot-BackEnd/
│   ├── Dockerfile              # Multi-stage Maven + Java 21 Dockerfile
│   ├── .dockerignore
│   ├── pom.xml                 # Maven dependencies (Spring Boot, PDFBox, POI, JJWT, AWS SDK)
│   ├── mvnw / mvnw.cmd
│   └── src/
│       ├── main/
│       │   ├── java/com/sumit/SpringBoot_BackEnd/
│       │   │   ├── SpringBootBackEndApplication.java
│       │   │   ├── config/       # AppConfig, JwtAuthFilter, SecurityConfig
│       │   │   ├── controller/   # AuthController, PdfController, AiController, HistoryController, ConvertController, SecureController
│       │   │   ├── model/        # Entities (User, ChatSession, HistoryEntry) and DTOs
│       │   │   ├── repository/   # UserRepository, ChatSessionRepository, HistoryRepository
│       │   │   ├── service/      # PDF, AI, Storage, Auth, and Conversion services
│       │   │   └── util/         # JwtUtil, SecurityUtil
│       │   └── resources/
│       │       ├── application.yml         # Core configuration (MySQL, JWT, Gemini, S3, Ports)
│       │       └── application.properties
│       └── test/
├── deployment/
│   └── nginx.conf              # Nginx reverse proxy config (HTTP→HTTPS, port 5001)
└── frontend/
    ├── index.html
    ├── vercel.json             # SPA rewrite
    ├── vite.config.js          # Vite config (proxies /api to http://localhost:5001)
    └── src/
        ├── App.jsx             # Router + protected routes
        ├── components/
        ├── context/
        │   └── AuthContext.jsx # Global auth state
        ├── pages/
        └── services/
            └── api.js          # Axios API client (base URL http://localhost:5001)
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
        │ proxy_pass → localhost:5001
        ▼
Docker Container (page-forge-backend)
  Spring Boot 3.3.0 API (Java 21)
        │
        ├── MySQL Database (page_forge)
        │     - users, chat_sessions, history_entries tables
        │
        ├── AWS S3 / Local Disk Storage
        │     - uploads/ & output storage
        │
        └── Google Gemini API
              - gemini-3.5-flash (summary + RAG chat)
              - text-embedding-004 (vector embeddings)
```

---

## API Reference

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Create account with email + password |
| `POST` | `/login` | Public | Login, receives access and refresh JWTs |
| `POST` | `/logout` | Public | Logout user session |
| `POST` | `/refresh` | Public | Issues new access token from refresh token |
| `GET` | `/me` | Required | Returns current user profile |

### PDF Operations — `/api/pdf`
| Method | Endpoint | Field(s) | Description |
|---|---|---|---|
| `POST` | `/merge` | `files[]` (multiple PDFs) | Merge into one PDF |
| `POST` | `/split` | `file`, `splitPages` | Split PDF by page ranges |
| `POST` | `/organize` | `file`, `operations` | Reorder/rotate/delete/insert pages |
| `POST` | `/edit` | `file`, `elements` | Overlay text/images/shapes/signatures |

### Convert — `/api/convert`
| Method | Endpoint | Field | Description |
|---|---|---|---|
| `POST` | `/word-to-pdf` | `file` (.docx) | Convert Word document to PDF |
| `POST` | `/pdf-to-word` | `file` (.pdf) | Extract text and export as .docx |

### Secure — `/api/secure`
| Method | Endpoint | Fields | Description |
|---|---|---|---|
| `POST` | `/protect` | `file`, `password` | Encrypt PDF with password |
| `POST` | `/unlock` | `file`, `password` | Remove PDF password protection |

### AI — `/api/ai` (Login required)
| Method | Endpoint | Fields | Description |
|---|---|---|---|
| `POST` | `/summarize` | `file` (.pdf) | Generate structured summary |
| `POST` | `/chat/upload` | `file` (.pdf) | Embed PDF into session |
| `POST` | `/chat/message` | `sessionId`, `question` | Send query and get response |
| `GET` | `/chat/sessions` | — | List user chat sessions |

---

## Environment Variables

In `SpringBoot-BackEnd/src/main/resources/application.yml` (or via environment variables):

```yaml
server:
  port: 5001

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/page_forge?createDatabaseIfNotExist=true&useSSL=false
    username: root
    password: root
    driver-class-name: com.mysql.cj.jdbc.Driver

jwt:
  secret: pageforge_jwt_secret_dev_key_must_be_at_least_32_bytes_long_for_hs256_security
  refresh-secret: pageforge_refresh_secret_dev_key_must_be_at_least_32_bytes_long_for_hs256_security

gemini:
  api-key: your_gemini_api_key

aws:
  s3:
    access-key: your_aws_access_key
    secret-key: your_aws_secret_key
    region: us-east-1
    bucket-name: page-forge-bucket
```

---

## Local Development

### Prerequisites
- Java 21 JDK
- Maven 3.9+ (or use included `./mvnw`)
- MySQL 8.0+
- Node.js 20+ (for Frontend)

### 1. Run Spring Boot Backend (Port 5001)

```bash
cd SpringBoot-BackEnd
./mvnw spring-boot:run
```

### 2. Run React Frontend (Port 5173)

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173` and proxy requests to the Spring Boot backend at `http://localhost:5001`.

---

## Production Deployment

### Docker Image (Backend)

```bash
# Build Docker image
docker build -t yourdockerhub/page-forge-backend:latest ./SpringBoot-BackEnd

# Run Docker container
docker run -d -p 5001:5001 --name page-forge-backend yourdockerhub/page-forge-backend:latest
```

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the Spring Boot Docker image from `./SpringBoot-BackEnd`, pushes it to Docker Hub, and deploys it to EC2 running on port 5001.

---

## License

MIT License — feel free to use and adapt for your own projects.
