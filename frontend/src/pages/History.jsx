import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileText, Trash2, Layers, Scissors, Grid, Edit3, Repeat, ShieldAlert, MessageSquare, Sparkles, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const OPERATION_META = {
  merge:    { label: 'Merged',    icon: Layers,       color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  split:    { label: 'Split',     icon: Scissors,     color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  organize: { label: 'Organized', icon: Grid,         color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  edit:     { label: 'Edited',    icon: Edit3,        color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  convert:  { label: 'Converted', icon: Repeat,       color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20' },
  secure:   { label: 'Secured',   icon: ShieldAlert,  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  chat:     { label: 'AI Chat',   icon: MessageSquare,color: 'text-brand-400',  bg: 'bg-brand-500/10 border-brand-500/20' },
  summary:  { label: 'Summary',   icon: Sparkles,     color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
};

function timeAgo(dateStr) {
  const now  = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)          return 'just now';
  if (diff < 3600)        return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)       return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7)   return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function History() {
  const { user } = useAuth();
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [deleting, setDeleting] = useState(null);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/api/history');
      setHistory(res.data.history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const deleteEntry = async (id) => {
    setDeleting(id);
    try {
      await api.delete(`/api/history/${id}`);
      setHistory(prev => prev.filter(h => h.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all history? This cannot be undone.')) return;
    try {
      await api.delete('/api/history');
      setHistory([]);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = filter === 'all' ? history : history.filter(h => h.operation === filter);
  const operations = [...new Set(history.map(h => h.operation))];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Activity History
          </h1>
          <p className="text-slate-400 text-sm">
            {history.length} operation{history.length !== 1 ? 's' : ''} tracked for <span className="text-brand-400">{user?.email}</span>
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Filter Pills */}
      {operations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {['all', ...operations].map(op => {
            const meta = op === 'all' ? null : OPERATION_META[op];
            return (
              <button
                key={op}
                onClick={() => setFilter(op)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  filter === op
                    ? 'bg-brand-500/20 border-brand-500/30 text-brand-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {op === 'all' ? `All (${history.length})` : (meta?.label || op)}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No history yet</p>
          <p className="text-slate-600 text-sm mt-1">
            {filter !== 'all' ? 'No entries match this filter.' : 'Start using PDF tools to see your activity here.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 mt-6 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all glow-brand"
          >
            <FileText className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const meta = OPERATION_META[entry.operation] || OPERATION_META.merge;
            const Icon = meta.icon;
            return (
              <div
                key={entry.id}
                className="glass-panel rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all duration-200 flex items-center space-x-4 group"
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${meta.bg}`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{entry.filename}</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-500">{timeAgo(entry.created_at || entry.createdAt)}</span>
                    {entry.metadata?.pages && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-500">{entry.metadata.pages} pages</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(entry.file_url || entry.fileUrl) && (
                    <a
                      href={entry.file_url || entry.fileUrl}
                      download={entry.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    disabled={deleting === entry.id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === entry.id
                      ? <div className="w-4 h-4 border border-slate-500 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
