'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header bar */}
      <header className="glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-2xl tracking-wider text-gradient font-outfit">ALPHASTRYK</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium hover:text-brand-500 transition">
            Sign In
          </Link>
          <Link href="/signup" className="text-sm font-semibold bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg transition shadow-md shadow-brand-500/20">
            Sign Up
          </Link>
        </nav>
      </header>

      {/* Hero Content */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 py-20 text-center max-w-5xl mx-auto">
        <div className="mb-4 inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          Phase 1 Complete: Auth & Security Active
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight font-outfit mb-6">
          Design the Future of <br />
          <span className="text-gradient">Athletic Apparel</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Create, customize, and checkout premium sports uniforms using our real-time 3D canvas designer. Powered by secure payments and role-based logistics.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-16">
          <Link href="/signup" className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition shadow-lg shadow-brand-600/30 text-lg">
            Create Free Account
          </Link>
          <Link href="/login" className="px-8 py-4 bg-gray-800/80 hover:bg-gray-700/80 text-white font-semibold rounded-xl transition border border-gray-700 text-lg">
            Access Portal
          </Link>
        </div>

        {/* Features list cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="glass-card glass-card-hover p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 font-bold mb-4">
              3D
            </div>
            <h3 className="text-lg font-bold mb-2">Interactive 3D Engine</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Configure materials, customize lettering, upload sponsors logos, and inspect high-fidelity GLTF meshes in real-time.
            </p>
          </div>

          <div className="glass-card glass-card-hover p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-bold mb-4">
              🔒
            </div>
            <h3 className="text-lg font-bold mb-2">Enterprise Security</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              JWT authentication via HTTP-only secure cookies, strict password hashing, login lockouts, and administrative audit logging.
            </p>
          </div>

          <div className="glass-card glass-card-hover p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 font-bold mb-4">
              💳
            </div>
            <h3 className="text-lg font-bold mb-2">Multi-Gateway Payments</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Ready for smooth transaction verification checks via Razorpay and PhonePe callback integrations.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} AlphaStryk. All rights reserved. Built with Next.js 15, Node, and Prisma ORM.
      </footer>
    </div>
  );
}
