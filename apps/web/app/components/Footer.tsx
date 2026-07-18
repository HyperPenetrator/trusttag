'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-6 mt-auto">
      <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div>
          &copy; {new Date().getFullYear()} TrustTag Protocol. All rights reserved.
        </div>
        <div className="flex items-center gap-1 bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-800 shadow-inner">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <Link
            href="/verify"
            id="link-verify-domain"
            className="hover:text-slate-300 font-semibold transition-colors"
          >
            Verify you're on the real TrustTag site
          </Link>
        </div>
      </div>
    </footer>
  );
}
