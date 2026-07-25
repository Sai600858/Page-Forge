import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Landing page after Google OAuth redirect.
 * Reads ?success=true or ?error=... from URL, syncs auth state, then redirects.
 */
export default function AuthCallback() {
  const { handleOAuthCallback } = useAuth();
  const navigate      = useNavigate();
  const [params]      = useSearchParams();

  useEffect(() => {
    const success = params.get('success');
    const error   = params.get('error');

    if (error) {
      navigate('/login?error=' + error, { replace: true });
      return;
    }

    if (success) {
      handleOAuthCallback().then(() => {
        navigate('/', { replace: true });
      });
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center space-y-4 text-slate-500">
        <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <span className="text-xs tracking-widest uppercase">Completing sign-in…</span>
      </div>
    </div>
  );
}
