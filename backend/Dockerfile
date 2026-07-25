# Use official light Node.js base image
FROM node:20-slim

# Install system dependencies (LibreOffice for Word-to-PDF conversion, qpdf for PDF encryption, and fonts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-common \
    qpdf \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Generate Prisma client for Neon PostgreSQL database query bindings
RUN npx prisma generate

# Ensure upload directory exists and is writable
RUN mkdir -p uploads && chmod 777 uploads

# Expose backend port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Start backend server
CMD ["npm", "start"]
