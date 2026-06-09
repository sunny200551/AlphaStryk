'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle Google Token Response
  const handleGoogleCallback = async (response: any) => {
    setError('');
    setIsLoading(true);
    try {
      const res = await apiFetch('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Google authentication failed.');
      } else {
        setSuccess('Authentication successful! Redirecting...');
        redirectUser(data.data.role);
      }
    } catch (err) {
      setError('Failed to reach authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initialise Google Identity
    const initializeGoogleGSI = () => {
      const google = (window as any).google;
      if (google && google.accounts) {
        google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'mock_google_client_id.apps.googleusercontent.com',
          callback: handleGoogleCallback,
        });
        google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { 
            theme: 'filled_black', 
            size: 'large', 
            width: '380',
            text: 'signin_with',
            shape: 'rectangular'
          }
        );
      }
    };

    // Retry load check if script takes moment
    const checkInterval = setInterval(() => {
      if ((window as any).google) {
        initializeGoogleGSI();
        clearInterval(checkInterval);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, []);

  const redirectUser = (role: string) => {
    setTimeout(() => {
      if (role === 'SUPER_ADMIN') {
        router.push('/dashboard/super-admin');
      } else if (role === 'ADMIN') {
        router.push('/dashboard/admin');
      } else {
        router.push('/dashboard/customer');
      }
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please provide email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed.');
      } else {
        setSuccess('Login successful! Redirecting...');
        redirectUser(data.data.role);
      }
    } catch (err) {
      setError('Failed to reach authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mock login triggers for easy testing
  const triggerMockGoogleLogin = async (mockEmail: string, name: string) => {
    setError('');
    setIsLoading(true);
    const mockToken = `mock_google_token_${Date.now()}_${mockEmail.split('@')[0]}_${encodeURIComponent(name)}`;
    try {
      const res = await apiFetch('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: mockToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Google authentication failed.');
      } else {
        setSuccess(`Logged in as ${name}! Redirecting...`);
        redirectUser(data.data.role);
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex justify-center items-center px-4 py-12">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl shadow-xl relative overflow-hidden">
        {/* Backdrop glow */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl"></div>

        <div className="text-center mb-8">
          <Link href="/" className="font-extrabold text-xl tracking-wider text-gradient font-outfit">
            ALPHASTRYK
          </Link>
          <h2 className="text-2xl font-bold mt-4 tracking-tight">Access Portal</h2>
          <p className="text-sm text-gray-400 mt-1">Sign in to manage custom designs</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg leading-relaxed">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Credentials Form */}
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

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-brand-400 hover:underline">
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
              'Sign In'
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0b101d] px-2 text-gray-500">Or connect with</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <div className="flex justify-center mb-6">
          <div id="google-signin-btn" className="w-full max-w-sm"></div>
        </div>

        {/* Development Quick-Bypass logins for testing */}
        <div className="border border-indigo-500/20 bg-indigo-500/5 p-4 rounded-xl mt-6">
          <span className="block text-2xs font-extrabold text-indigo-400 uppercase tracking-wider mb-2 text-center">
            Developer Mock Credentials (Phase 1 Testing Bypass)
          </span>
          <div className="grid grid-cols-2 gap-2 text-2xs">
            <button
              onClick={() => triggerMockGoogleLogin('superadmin@alphastryk.com', 'Mock Super Admin')}
              className="bg-gray-900 hover:bg-gray-800 text-gray-300 py-1.5 px-2 rounded border border-gray-800 font-semibold"
            >
              Google Super Admin
            </button>
            <button
              onClick={() => triggerMockGoogleLogin('admin@alphastryk.com', 'Mock Admin')}
              className="bg-gray-900 hover:bg-gray-800 text-gray-300 py-1.5 px-2 rounded border border-gray-800 font-semibold"
            >
              Google Admin
            </button>
            <button
              onClick={() => triggerMockGoogleLogin('customer@alphastryk.com', 'Mock Customer')}
              className="bg-gray-900 hover:bg-gray-800 text-gray-300 py-1.5 px-2 rounded border border-gray-800 col-span-2 font-semibold"
            >
              Google Customer
            </button>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-gray-400">
          Don't have an account?{' '}
          <Link href="/signup" className="text-brand-400 hover:underline font-semibold">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
