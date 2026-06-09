'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '../../lib/api';

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading verification panel...</div>}>
      <VerifyEmailComponent />
    </React.Suspense>
  );
}

function VerifyEmailComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. Missing token parameters.');
        return;
      }

      try {
        const res = await apiFetch('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully! You can now access all customer benefits.');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed. The link may have expired.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Network failure connecting to verification server.');
      }
    };

    performVerification();
  }, [token]);

  return (
    <div className="flex-1 flex justify-center items-center px-4 py-12">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl shadow-xl text-center relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-brand-500/20 rounded-full blur-2xl"></div>

        <div className="mb-6">
          <Link href="/" className="font-extrabold text-xl tracking-wider text-gradient font-outfit">
            ALPHASTRYK
          </Link>
        </div>

        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-300 text-sm font-semibold">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto text-green-400 text-xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
            <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
            <div className="pt-4">
              <Link href="/login" className="w-full inline-block py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition text-sm shadow-md shadow-brand-600/20">
                Proceed to Login
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400 text-xl font-bold">
              ✕
            </div>
            <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
            <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
            <div className="pt-4">
              <Link href="/signup" className="w-full inline-block py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-700 transition text-sm">
                Try Re-registering
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
