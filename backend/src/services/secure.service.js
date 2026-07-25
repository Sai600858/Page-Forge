import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF } from '@pdfsmaller/pdf-decrypt';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFilePromise = promisify(execFile);

const getQpdfBinary = () => {
  if (process.platform === 'win32') {
    const defaultPaths = [
      'C:\\Program Files\\qpdf 12.3.2\\bin\\qpdf.exe',
      'C:\\Program Files\\qpdf\\bin\\qpdf.exe',
      'C:\\Program Files (x86)\\qpdf\\bin\\qpdf.exe',
    ];
    for (const p of defaultPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  }
  return 'qpdf';
};

const sanitizeErrorMessage = (errText, fallback) => {
  if (!errText) return fallback;
  let clean = errText.trim();
  // Strip command prefix
  clean = clean.replace(/^qpdf: /i, '');
  // If it contains a path followed by a colon (e.g. C:\path\to\file.pdf: invalid password)
  const parts = clean.split(':');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart) {
      clean = lastPart;
    }
  }
  // Capitalize first letter
  if (clean) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean || fallback;
};

export const protectPDF = async (filePath, password) => {
  if (!password) {
    throw new Error('Password is required to encrypt PDF');
  }

  const dirName = path.dirname(filePath);
  const extName = path.extname(filePath);
  const baseName = path.basename(filePath, extName);
  const tempOutputPath = path.join(dirName, `${baseName}-encrypted-${Date.now()}${extName}`);

  try {
    // Attempt encryption using qpdf (uses 256-bit AES, highly robust)
    await execFilePromise(getQpdfBinary(), [
      '--encrypt',
      password, // User password
      password, // Owner password
      '256', // Key length
      '--',
      filePath,
      tempOutputPath
    ]);

    const encryptedBytes = fs.readFileSync(tempOutputPath);

    // Clean up temporary output file
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }

    return encryptedBytes;
  } catch (qpdfError) {
    // Clean up temporary output file if it was created
    if (fs.existsSync(tempOutputPath)) {
      try { fs.unlinkSync(tempOutputPath); } catch (e) {}
    }

    // Fall back to pure JS library if qpdf is not installed (e.g. locally)
    if (qpdfError.code === 'ENOENT') {
      console.warn('qpdf is not installed/found. Falling back to @pdfsmaller/pdf-encrypt.');
      const pdfBytes = fs.readFileSync(filePath);
      const uint8Bytes = new Uint8Array(pdfBytes);
      const encryptedBytes = await encryptPDF(uint8Bytes, password);
      return Buffer.from(encryptedBytes);
    } else {
      console.error('QPDF encryption failed:', qpdfError.message);
      const errMsg = sanitizeErrorMessage(qpdfError.stderr, 'Failed to encrypt PDF');
      if (errMsg.toLowerCase().includes('invalid password')) {
        throw new Error('This PDF is password-protected. Please unlock it before encrypting.');
      }
      throw new Error(errMsg);
    }
  }
};

export const unlockPDF = async (filePath, password) => {
  if (!password) {
    throw new Error('Password is required to decrypt PDF');
  }

  const dirName = path.dirname(filePath);
  const extName = path.extname(filePath);
  const baseName = path.basename(filePath, extName);
  const tempOutputPath = path.join(dirName, `${baseName}-decrypted-${Date.now()}${extName}`);

  try {
    // Attempt decryption using qpdf first (robust, handles all standard versions including bank statements)
    await execFilePromise(getQpdfBinary(), [
      `--password=${password}`,
      '--decrypt',
      filePath,
      tempOutputPath
    ]);
    
    // Read the decrypted bytes
    const decryptedBytes = fs.readFileSync(tempOutputPath);
    
    // Clean up temporary output file
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
    
    return decryptedBytes;
  } catch (qpdfError) {
    // Clean up temporary output file if it was created
    if (fs.existsSync(tempOutputPath)) {
      try { fs.unlinkSync(tempOutputPath); } catch (e) {}
    }

    // If qpdf was not found (not installed locally), fall back to pure JS decryptPDF
    if (qpdfError.code === 'ENOENT') {
      console.warn('qpdf is not installed/found. Falling back to @pdfsmaller/pdf-decrypt.');
      
      const pdfBytes = fs.readFileSync(filePath);
      const uint8Bytes = new Uint8Array(pdfBytes);
      
      try {
        const decryptedBytes = await decryptPDF(uint8Bytes, password);
        return Buffer.from(decryptedBytes);
      } catch (jsError) {
        throw new Error('Incorrect password or failed to decrypt PDF');
      }
    } else {
      // QPDF was found but failed (e.g. incorrect password or other issue)
      console.error('QPDF decryption failed:', qpdfError.message);
      const errMsg = sanitizeErrorMessage(qpdfError.stderr, 'Incorrect password or failed to decrypt PDF');
      if (errMsg.toLowerCase().includes('invalid password')) {
        throw new Error('Incorrect password');
      }
      throw new Error(errMsg);
    }
  }
};
