import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,   // Required: sends HTTP-only auth cookies cross-origin
});

// Response interceptor to handle Blob errors (status 400/500 returns error as JSON inside a Blob)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.data instanceof Blob && error.response.data.type === 'application/json') {
      try {
        const text = await error.response.data.text();
        const parsed = JSON.parse(text);
        error.response.data = parsed;
      } catch (e) {
        // Fallback
      }
    }
    return Promise.reject(error);
  }
);

// Helper to trigger direct browser download of a blob response
export const downloadBlob = (response, defaultFilename) => {
  const getHeader = (headers, name) => {
    if (!headers) return '';
    if (typeof headers.get === 'function') {
      return headers.get(name) || '';
    }
    const lowerName = name.toLowerCase();
    for (const key in headers) {
      if (key.toLowerCase() === lowerName) {
        return headers[key] || '';
      }
    }
    return '';
  };

  const contentType = getHeader(response.headers, 'Content-Type');
  const contentDisposition = getHeader(response.headers, 'Content-Disposition');

  console.log('[downloadBlob] Response headers:', response.headers);
  console.log('[downloadBlob] Content-Disposition:', contentDisposition);

  if (contentType && contentType.toLowerCase().includes('application/json')) {
    console.error('downloadBlob received JSON response instead of document blob.');
    return;
  }

  // Ensure we have a Blob. Axios responseType: 'blob' returns response.data as Blob.
  const blob = response.data instanceof Blob 
    ? response.data 
    : new Blob([response.data], { type: contentType || 'application/octet-stream' });

  let filename = '';

  // Try to extract from Content-Disposition first
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=["']?(?:UTF-8'')?([^;"']+)["']?/i);
    if (match && match[1]) {
      try {
        filename = decodeURIComponent(match[1].trim());
      } catch (e) {
        filename = match[1].trim();
      }
    }
  }

  // Fallback to defaultFilename
  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    filename = defaultFilename || 'document';
  }

  // Clean filename of any potential path prefix/suffix or quotes
  filename = filename.replace(/["']/g, '').trim();

  // Enforce proper extension if missing
  const filenameLower = filename.toLowerCase();
  const contentTypeLower = contentType ? contentType.toLowerCase() : '';
  
  if (contentTypeLower.includes('pdf')) {
    if (!filenameLower.endsWith('.pdf')) {
      filename += '.pdf';
    }
  } else if (contentTypeLower.includes('word') || contentTypeLower.includes('officedocument') || contentTypeLower.includes('docx')) {
    if (!filenameLower.endsWith('.docx')) {
      filename += '.docx';
    }
  } else if (contentTypeLower.includes('zip')) {
    if (!filenameLower.endsWith('.zip')) {
      filename += '.zip';
    }
  } else {
    // If we still don't have an extension, try to infer it from defaultFilename or content-type
    if (!filename.includes('.')) {
      if (defaultFilename && defaultFilename.includes('.')) {
        const ext = defaultFilename.split('.').pop();
        filename += '.' + ext;
      } else {
        filename += '.pdf'; // default fallback
      }
    }
  }

  console.log('[downloadBlob] Triggering download for final filename:', filename);

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  link.setAttribute('download', filename); // Set both property and attribute
  
  document.body.appendChild(link);
  link.click();
  
  // Clean up after 1s to allow browser to handle the download before URL revocation
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    window.URL.revokeObjectURL(url);
  }, 1000);
};


export const mergePDFs = (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post('/api/pdf/merge', formData, { responseType: 'blob' });
};

export const splitPDF = (file, splitPages) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('splitPages', splitPages);
  return api.post('/api/pdf/split', formData, { responseType: 'blob' });
};

export const organizePDF = (file, operations) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('operations', JSON.stringify(operations));
  return api.post('/api/pdf/organize', formData, { responseType: 'blob' });
};

export const editPDF = (file, elements) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('elements', JSON.stringify(elements));
  return api.post('/api/pdf/edit', formData, {
    responseType: 'blob',
    timeout: 5 * 60 * 1000,        // 5 minutes — large PDFs need time
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
};

export const convertWordToPdf = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/convert/word-to-pdf', formData, { responseType: 'blob' });
};

export const convertPdfToWord = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/convert/pdf-to-word', formData, { responseType: 'blob' });
};

export const protectPDF = (file, password) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);
  return api.post('/api/secure/protect', formData, { responseType: 'blob' });
};

export const unlockPDF = (file, password) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);
  return api.post('/api/secure/unlock', formData, { responseType: 'blob' });
};

// ─── AI Endpoints ─────────────────────────────────────────────────────────────
export const summarizePDF = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/ai/summarize', formData);
};

export const uploadPDFForChat = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/ai/chat/upload', formData);
};

export const getChatSessions = () => api.get('/api/ai/chat/sessions');
export const getChatSession = (id) => api.get(`/api/ai/chat/sessions/${id}`);
export const deleteChatSession = (id) => api.delete(`/api/ai/chat/sessions/${id}`);

export default api;
