'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please provide your email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message || 'Verification link generated. Check email for details.');
        setEmail('');
      } else {
        setError(data.message || 'Failed to submit request.');
      }
    } catch (err) {
      setError('Connection error to auth services.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex justify-center items-center px-4 py-12">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-brand-500/20 rounded-full blur-2xl"></div>

        <div className="text-center mb-8">
          <Link href="/" className="font-extrabold text-xl tracking-wider text-gradient font-outfit">
            ALPHASTRYK
          </Link>
          <h2 className="text-2xl font-bold mt-4 tracking-tight">Recover Password</h2>
          <p className="text-sm text-gray-400 mt-1">Receive password recovery credentials link</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-lg leading-relaxed">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3 text-sm text-white transition focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-800 text-white font-semibold rounded-lg transition shadow-md shadow-brand-600/20 text-sm mt-4 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
            ) : (
              'Send Recovery Link'
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-gray-400">
          Remember credentials?{' '}
          <Link href="/login" className="text-brand-400 hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
