import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';

interface LegalLayoutProps {
  children: React.ReactNode;
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/80 border-separator1 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <Link
            href="/login"
            className="text-fg2 hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            Back to Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
      <footer className="border-separator1 mt-12 border-t">
        <div className="text-fg3 mx-auto max-w-4xl px-6 py-8 text-center text-sm">
          © {new Date().getFullYear()} Melochora LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
