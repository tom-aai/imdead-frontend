import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';

interface LegalLayoutProps {
  children: React.ReactNode;
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-separator1">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-fg2 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            Back to Home
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">{children}</main>
      <footer className="border-t border-separator1 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-sm text-fg3">
          © {new Date().getFullYear()} Melochora LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
