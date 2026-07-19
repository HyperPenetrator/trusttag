'use client';

import { RegisterItemForm } from '../../components/RegisterItemForm';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-xl mx-auto">

        {/* Back nav */}
        <Link
          href="/owner"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>
        <h2 className="text-2xl font-bold text-white tracking-tight">Create Digital Certificate</h2>
        <p className="text-xs text-slate-500 mt-1">
          Mint a unique Proof-of-Custody Token (PoCT) representing verified item ownership.
        </p>
      </div>

      <div className="glass-panel p-8 rounded-3xl border border-white/5 shadow-xl max-w-xl mx-auto mt-6">
        <RegisterItemForm
          onSuccess={() => {
            // Navigate back to owner home after successful registration
            router.push('/owner');
          }}
        />
      </div>

    </main>
  );
}
