'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatCircle, CircleNotch } from '@phosphor-icons/react';
import type { BlogEntry } from '@/app/api/blog/route';

export default function BlogPage() {
  const [entries, setEntries] = useState<BlogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchEntries = async () => {
      try {
        const response = await fetch('/api/blog');
        if (!response.ok) {
          throw new Error('Failed to load blog');
        }
        const data = await response.json();
        if (!cancelled) setEntries(data.entries || []);
      } catch (err) {
        console.error('Error loading blog:', err);
        if (!cancelled) setError('Could not load the blog right now. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEntries();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-background min-h-screen">
      {/* Header */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-border sticky top-0 z-10 border-b backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Expert Avatar Blog</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Browse expert avatars and start a conversation.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <CircleNotch size={32} className="text-muted-foreground animate-spin" />
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-destructive">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground text-lg">No avatars yet</p>
              <p className="text-muted-foreground text-sm">Check back soon.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <div
                key={entry.session_id}
                className="group bg-card border-border overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Avatar Image */}
                <div className="bg-muted relative flex aspect-square items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.avatar_image_url}
                    alt={entry.main_topic}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Card Content */}
                <div className="space-y-4 p-4">
                  <h3 className="line-clamp-2 text-lg font-semibold">{entry.main_topic}</h3>

                  <Link
                    href={`/chat/${entry.share_token}`}
                    className="bg-primary text-primary-foreground hover:bg-primary-hover flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <ChatCircle size={16} className="mr-2" />
                    Talk to avatar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
