import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  uploadPDFForChat, getChatSessions, getChatSession, deleteChatSession 
} from '../services/api';
import DropZone from '../components/DropZone';
import { 
  MessageSquare, Sparkles, Send, Trash2, Plus, File, Loader2, AlertCircle, 
  ChevronLeft, ChevronRight, User, Bot, HelpCircle
} from 'lucide-react';

export default function ChatPDF() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);

  // Chat UI states
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState([
    'Summarize this document',
    'What are the key points in this PDF?',
    'List all important dates and events',
    'Find any action items or tasks mentioned',
  ]);

  const messagesEndRef = useRef(null);
  // Ref-based lock to prevent StrictMode double-invocation from firing two fetches
  const isStreamingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Load past sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const res = await getChatSessions();
      setSessions(res.data.sessions || []);
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  };

  const handleNewSession = () => {
    setActiveSession(null);
    setActiveFile(null);
    setFileUrl(null);
    setMessages([]);
    setError(null);
  };

  const handleSelectSession = async (session) => {
    setError(null);
    setLoading(true);
    setLoadingStep('Retrieving chat history...');
    try {
      const res = await getChatSession(session.id);
      setActiveSession(res.data.session);
      setMessages(res.data.session.messages || []);
      
      // Load preview of the document from the URL provided by the backend (S3 or local static)
      setFileUrl(res.data.session.pdfUrl);
      setActiveFile({ name: res.data.session.doc_name });
    } catch (err) {
      console.error(err);
      setError('Failed to load session details.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat session and its vector indexes?')) return;
    try {
      await deleteChatSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSession?.id === id) {
        handleNewSession();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to delete chat session.');
    }
  };

  // Upload and parse PDF file for RAG pipeline
  const handleFiles = async (incoming) => {
    const pdf = incoming.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) {
      setError('Only PDF files are accepted.');
      return;
    }

    setActiveFile(pdf);
    setError(null);
    setLoading(true);
    setLoadingStep('Parsing PDF pages...');

    try {
      await new Promise(r => setTimeout(r, 600));
      setLoadingStep('Chunking text & generating vector embeddings...');
      
      const res = await uploadPDFForChat(pdf);
      
      // Keep track of session state
      setActiveSession({ id: res.data.sessionId, doc_name: res.data.docName });
      setMessages([]);
      if (res.data.suggestions) {
        setSuggestions(res.data.suggestions);
      }
      
      // Generate a local browser preview URL
      const url = URL.createObjectURL(pdf);
      setFileUrl(url);
      
      // Refresh sidebar list
      await fetchSessions();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to process document. Please try again.');
      setActiveFile(null);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Ask Question via SSE Stream
  const sendMessage = async (textToSend) => {
    const message = textToSend || inputMessage;
    // Synchronous ref check — state updates are async/batched, so streaming state
    // can't prevent StrictMode's double invocation from firing two fetches
    if (!message.trim() || !activeSession || isStreamingRef.current) return;

    // Abort any ongoing stream (catches StrictMode's first concurrent call)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setInputMessage('');
    setError(null);

    // Add user message to UI
    const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    isStreamingRef.current = true;
    setStreaming(true);

    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ai/chat/message`;
      
      // Add a placeholder for assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date().toISOString() }]);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          sessionId: activeSession.id,
          question: message
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        // Skip empty reads (happens on stream end)
        if (!value || value.length === 0) continue;

        // Always decode with stream:true to prevent TextDecoder from flushing
        // buffered bytes twice on stream completion
        const chunk = decoder.decode(value, { stream: true });
        
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                setMessages(prev => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'assistant') {
                    last.content += parsed.text;
                  }
                  return next;
                });
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Ignore partial parsing errors on incomplete JSON chunks
            }
          }
        }
      }
    } catch (err) {
      // Ignore aborts — these come from StrictMode's cleanup of the first mount
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || 'Error occurred while streaming the response.');
      // Remove the last placeholder if it was empty
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          next.pop();
        }
        return next;
      });
    } finally {
      isStreamingRef.current = false;
      setStreaming(false);
      // Refresh sidebar sessions to update timeline
      await fetchSessions();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[calc(100vh-10rem)]">
        
        {/* Left Column: Sidebar with Session History */}
        <div className="lg:col-span-3 flex flex-col gap-4 border-r border-white/5 pr-4">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl border border-dashed border-white/10 hover:border-brand-500/50 hover:bg-brand-500/5 text-xs font-semibold text-white transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>New Document Chat</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] lg:max-h-none pr-1">
            <h3 className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mb-3">Recent Sessions</h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-600 italic py-4">No past sessions found.</p>
            ) : (
              sessions.map((s) => {
                const isActive = activeSession?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
                      isActive 
                        ? 'bg-brand-500/10 border-brand-500/30 text-white' 
                        : 'bg-slate-900/10 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <MessageSquare className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                      <span className="text-xs truncate font-medium" title={s.doc_name}>{s.doc_name}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Workspace */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          
          {error && (
            <div className="flex items-start space-x-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Upload state */}
          {!activeFile && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-900/10 border border-white/5 rounded-2xl p-8 max-w-xl mx-auto w-full">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6 text-brand-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Chat with your PDF</h2>
              <p className="text-slate-400 text-sm text-center mb-8">
                Upload any PDF file. We will extract its paragraphs, generate vector embeddings, and let you ask questions in real-time.
              </p>
              <div className="w-full">
                <DropZone
                  accept=".pdf"
                  onFiles={handleFiles}
                  label="Select PDF File"
                  subLabel="PDF format only — up to 30MB"
                />
              </div>
            </div>
          )}

          {/* 2. Loading State */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-32">
              <Loader2 className="w-10 h-10 animate-spin text-brand-400 mb-4" />
              <p className="text-sm text-slate-400 font-semibold">{loadingStep}</p>
            </div>
          )}

          {/* 3. Split-Pane Chat Interface */}
          {activeFile && !loading && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Document Preview (Left) */}
              <div className="md:col-span-5 flex flex-col gap-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-semibold text-slate-400 truncate max-w-[80%]" title={activeFile.name}>
                    {activeFile.name}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Preview</span>
                </div>
                
                {fileUrl ? (
                  <iframe
                    src={fileUrl}
                    className="w-full h-[550px] rounded-2xl border border-white/5 bg-slate-950/40"
                    title="PDF Document Preview"
                  />
                ) : (
                  <div className="w-full h-[550px] rounded-2xl border border-white/5 bg-slate-950/20 flex flex-col items-center justify-center text-center p-6 text-slate-600">
                    <File className="w-12 h-12 mb-3 opacity-40" />
                    <p className="text-xs">Preview unavailable for past sessions</p>
                    <p className="text-[10px] mt-1 opacity-75">You can still chat with this document using the interface on the right.</p>
                  </div>
                )}
              </div>

              {/* Chat Panel (Right) */}
              <div className="md:col-span-7 flex flex-col rounded-2xl border border-white/5 bg-slate-950/40 overflow-hidden h-[582px]">
                
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <Bot className="w-8 h-8 text-brand-400/50 mb-3" />
                      <p className="text-xs font-semibold text-slate-400">PDF successfully indexed!</p>
                      <p className="text-[11px] mt-1">Ask a question below or choose one of the suggestions to begin.</p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isUser = m.role === 'user';
                      return (
                        <div key={idx} className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
                          {!isUser && (
                            <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0 text-brand-400">
                              <Bot className="w-4 h-4" />
                            </div>
                          )}
                          <div className={`p-3.5 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                            isUser 
                              ? 'bg-brand-600 text-white rounded-tr-none' 
                              : 'bg-slate-900/60 border border-white/5 text-slate-200 rounded-tl-none'
                          }`}>
                            {isUser ? (
                              <p className="whitespace-pre-line">{m.content}</p>
                            ) : (
                              <div className="markdown-prose whitespace-pre-line">
                                <ReactMarkdown>
                                  {m.content || '...'}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                          {isUser && (
                            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-slate-400">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Suggestions chips */}
                {messages.length === 0 && suggestions.length > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-white/5 bg-slate-900/20">
                    {suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(sug)}
                        disabled={streaming}
                        className="text-[10px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:border-brand-500/30 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input form */}
                <form 
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="p-3 border-t border-white/5 bg-slate-950 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={streaming}
                    placeholder={streaming ? "Streaming AI response..." : "Ask anything about this document..."}
                    className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={streaming || !inputMessage.trim()}
                    className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {streaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
