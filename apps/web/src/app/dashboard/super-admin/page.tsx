'use client';

import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SuperAdminConsole from '../../../components/SuperAdminConsole';

export default function SuperAdminDashboard() {
  const { user, loading, logout } = useAuth(['SUPER_ADMIN']);
  
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">ALPHASTRYK</span>
          <span className="bg-purple-500/10 text-purple-400 text-3xs font-extrabold tracking-wider px-1.5 py-0.5 rounded border border-purple-500/20 uppercase">
            Super Admin Portal
          </span>
        </div>
        <button
          onClick={logout}
          className="text-xs font-semibold px-4 py-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
        >
          Logout
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Card */}
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden border border-brand-500/10 shadow-lg shadow-brand-500/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -z-10"></div>
          
          <span className="bg-purple-500/10 text-purple-400 text-2xs font-extrabold tracking-wider px-2.5 py-1 rounded-md border border-purple-500/20 uppercase">
            Root Administrator
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold font-outfit mt-4 mb-2">
            Super Admin Console: {user?.name || 'Administrator'}
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-xl leading-relaxed">
            Full system control. Access core security logs, verify payments status, process overrides, manage administrator permissions, and execute audit checks.
          </p>
        </div>

        {/* Administration Console Area */}
        <div className="glass-card p-6 rounded-3xl border border-brand-500/5">
          <h2 className="text-lg font-bold font-outfit mb-4">Super Admin Workspace Controls</h2>
          <SuperAdminConsole />
        </div>
      </main>
    </div>
  );
}

