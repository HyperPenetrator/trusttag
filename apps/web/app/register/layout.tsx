import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register an Item — TrustTag Protocol',
  description:
    'Mint a non-transferable Proof-of-Custody Token for your physical item. ' +
    'Photos and details are encrypted in your browser before being pinned to IPFS.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
