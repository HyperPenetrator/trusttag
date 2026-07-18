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
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-6 md:p-8">
          <RegisterItemForm
            onSuccess={() => {
              // Navigate back to owner dashboard after successful registration
              setTimeout(() => router.push('/owner'), 1500);
            }}
          />
        </div>

      </div>
    </main>
  );
}
