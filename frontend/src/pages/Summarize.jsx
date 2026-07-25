import React, { useState } from 'react';
import { summarizePDF } from '../services/api';
import DropZone from '../components/DropZone';
import { 
  Sparkles, FileText, Calendar, CheckSquare, HelpCircle, 
  Copy, Download, RefreshCw, Loader2, AlertCircle, Check, File
} from 'lucide-react';

export default function Summarize() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [copied, setCopied] = useState(false);

  const handleFiles = async (incoming) => {
    const pdf = incoming.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) {
      setError('Only PDF files are accepted.');
      return;
    }
    
    setFile(pdf);
    setError(null);
    setResult(null);
    setLoading(true);
    
    try {
      setLoadingStep('Extracting document contents...');
      // Small timeout simulation for smooth step transitions
      await new Promise(r => setTimeout(r, 600));
      
      setLoadingStep('Structuring layout & analysis...');
      await new Promise(r => setTimeout(r, 600));
      
      setLoadingStep('Synthesizing summary with Gemini AI...');
      const res = await summarizePDF(pdf);
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate document summary. Please try again.');
      setFile(null);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const getMarkdown = () => {
    if (!result) return '';
    return `# AI Document Summary: ${file ? file.name : ''}

## Summary
${result.summary || ''}

## Key Takeaway Points
${result.keyPoints?.map(p => `- ${p}`).join('\n') || 'None identified.'}

## Important Dates & Deadlines
${result.importantDates?.map(d => `- ${d}`).join('\n') || 'None identified.'}

## Recommended Action Items
${result.actionItems?.map(a => `- [ ] ${a}`).join('\n') || 'None identified.'}

## Frequently Asked Questions
${result.faqs?.map(f => `### Q: ${f.q}\n${f.a}\n`).join('\n') || 'None identified.'}
    `.trim();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = getMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file.name.replace('.pdf', '')}_summary.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Tab configurations
  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'points', label: 'Key Points', icon: Sparkles },
    { id: 'dates', label: 'Important Dates', icon: Calendar },
    { id: 'actions', label: 'Action Items', icon: CheckSquare },
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-left relative">
      {/* Background decoration */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="mb-8 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
          <Sparkles className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Document Summary</h1>
          <p className="text-slate-400 text-sm">Upload any PDF to get structured summaries, key takeaways, timelines, and FAQs.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start space-x-2 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 max-w-2xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Workspace */}
      {!file && !loading && (
        <div className="max-w-lg mx-auto">
          <DropZone
            accept=".pdf"
            onFiles={handleFiles}
            label="Upload PDF Document"
            subLabel="PDF files only — powered by Gemini AI"
            className="min-h-[280px]"
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" />
            <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Analyzing PDF</h3>
          <p className="text-sm text-slate-400 min-h-[20px] transition-all duration-300">
            {loadingStep}
          </p>
        </div>
      )}

      {/* Loaded Analysis View */}
      {result && (
        <div className="space-y-6">
          {/* Metadata Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-slate-900/40">
            <div className="flex items-center space-x-3 overflow-hidden">
              <File className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-3 py-2 text-xs font-medium rounded-lg border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Copy markdown to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center space-x-1 px-3 py-2 text-xs font-medium rounded-lg border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Download as Markdown file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download (.md)</span>
              </button>

              <button
                onClick={reset}
                className="flex items-center space-x-1 px-3 py-2 text-xs font-medium rounded-lg border border-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Upload New</span>
              </button>
            </div>
          </div>

          {/* Tabs UI & Content layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Tab Selectors */}
            <div className="md:col-span-3 flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 border-b md:border-b-0 border-white/5 pb-2 md:pb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-left transition-all duration-200 whitespace-nowrap md:whitespace-normal ${
                      active 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Active Tab Workspace */}
            <div className="md:col-span-9 rounded-2xl border border-white/5 bg-slate-950/70 p-6 sm:p-8 min-h-[350px]">
              {/* Tab: Summary */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" /> Executive Summary
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {result.summary}
                  </p>
                </div>
              )}

              {/* Tab: Key Points */}
              {activeTab === 'points' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Key Takeaways
                  </h3>
                  {result.keyPoints && result.keyPoints.length > 0 ? (
                    <ul className="space-y-3">
                      {result.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start space-x-3 text-sm text-slate-300">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] text-indigo-400 font-bold mt-0.5">
                            {index + 1}
                          </span>
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No key points identified in this document.</p>
                  )}
                </div>
              )}

              {/* Tab: Dates */}
              {activeTab === 'dates' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" /> Timeline & Key Dates
                  </h3>
                  {result.importantDates && result.importantDates.length > 0 ? (
                    <div className="relative border-l border-white/5 ml-3 pl-6 space-y-6">
                      {result.importantDates.map((dateStr, index) => (
                        <div key={index} className="relative">
                          <span className="absolute -left-[30px] top-1 w-2 h-2 rounded-full bg-indigo-500 border border-slate-950" />
                          <p className="text-sm text-slate-200 leading-relaxed font-semibold">
                            {dateStr}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No specific dates or deadlines detected in this document.</p>
                  )}
                </div>
              )}

              {/* Tab: Action Items */}
              {activeTab === 'actions' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-400" /> Recommended Action Items
                  </h3>
                  {result.actionItems && result.actionItems.length > 0 ? (
                    <div className="space-y-3">
                      {result.actionItems.map((item, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border border-white/5 bg-slate-900/20">
                          <input 
                            type="checkbox" 
                            className="w-4.5 h-4.5 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 focus:ring-offset-0 mt-0.5 cursor-pointer"
                          />
                          <span className="text-sm text-slate-300 leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No explicit tasks or action items were found in the document.</p>
                  )}
                </div>
              )}

              {/* Tab: FAQs */}
              {activeTab === 'faqs' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-indigo-400" /> Frequently Asked Questions
                  </h3>
                  {result.faqs && result.faqs.length > 0 ? (
                    <div className="space-y-4">
                      {result.faqs.map((faq, index) => (
                        <div key={index} className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-2">
                          <p className="text-sm font-semibold text-white flex items-start gap-2">
                            <span className="text-indigo-400">Q:</span> {faq.q}
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed pl-5 whitespace-pre-line">
                            {faq.a}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No question-answer pairs generated for this document.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
