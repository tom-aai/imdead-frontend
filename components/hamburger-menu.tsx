'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/supabase';
import { List } from '@phosphor-icons/react';
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
    <div
      ref={menuRef}
      className={cn(
        'z-50',
        inline ? 'relative' : 'fixed top-4 right-4'
      )}
    >
      {/* Hamburger circle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
        aria-label="Open menu"
      >
        <List size={24} weight="bold" className="text-foreground" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-14 right-0 bg-primary rounded-lg shadow-xl overflow-hidden min-w-[160px]">
          <button
            onClick={handleDashboard}
            className="w-full px-4 py-3 text-left text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer"
          >
            Dashboard
          </button>
          <button
            onClick={handleRecloneVoice}
            className="w-full px-4 py-3 text-left text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer"
          >
            Re-Clone Voice
          </button>
          <button
            onClick={handleSettings}
            className="w-full px-4 py-3 text-left text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer"
          >
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

