'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { List } from '@phosphor-icons/react';
import { signOut } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface HamburgerMenuProps {
  /** When true, uses relative positioning for inline placement (e.g., in a header row) */
  inline?: boolean;
}

export function HamburgerMenu({ inline = false }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDashboard = () => {
    setIsOpen(false);
    router.push('/dashboard');
  };

  const handleRecloneVoice = () => {
    setIsOpen(false);
    router.push('/reclone-voice');
  };

  const handleSettings = () => {
    setIsOpen(false);
    router.push('/settings');
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    router.push('/login');
  };

  return (
    <div ref={menuRef} className={cn('z-50', inline ? 'relative' : 'fixed top-4 right-4')}>
      {/* Hamburger circle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-muted hover:bg-muted/80 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-lg transition-colors"
        aria-label="Open menu"
      >
        <List size={24} weight="bold" className="text-foreground" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="bg-primary absolute top-14 right-0 min-w-[160px] overflow-hidden rounded-lg shadow-xl">
          <button
            onClick={handleDashboard}
            className="text-primary-foreground hover:bg-primary/80 w-full cursor-pointer px-4 py-3 text-left text-sm font-medium transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={handleRecloneVoice}
            className="text-primary-foreground hover:bg-primary/80 w-full cursor-pointer px-4 py-3 text-left text-sm font-medium transition-colors"
          >
            Re-Clone Voice
          </button>
          <button
            onClick={handleSettings}
            className="text-primary-foreground hover:bg-primary/80 w-full cursor-pointer px-4 py-3 text-left text-sm font-medium transition-colors"
          >
            Settings
          </button>
          <a
            href="mailto:support@melochora.com"
            onClick={() => setIsOpen(false)}
            className="text-primary-foreground hover:bg-primary/80 block w-full cursor-pointer px-4 py-3 text-left text-sm font-medium transition-colors"
          >
            Support
          </a>
          <button
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary/80 w-full cursor-pointer px-4 py-3 text-left text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
