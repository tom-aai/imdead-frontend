'use client';

import { useRef, useState } from 'react';
import { CircleNotch, FileText, UploadSimple } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getSupabaseClient } from '@/lib/supabase';

// D5 length bounds. Kept in sync with the backend, which is authoritative and
// will reject out-of-range text with a 400 we surface inline.
const MIN_CHARS = 200;
const MAX_CHARS = 50_000;

interface BlogUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const BlogUploadModal = ({ open, onOpenChange, onSuccess }: BlogUploadModalProps) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = text.trim().length;
  const tooShort = charCount > 0 && charCount < MIN_CHARS;
  const tooLong = charCount > MAX_CHARS;

  const resetAndClose = () => {
    if (isSubmitting) return;
    setText('');
    setError(null);
    onOpenChange(false);
  };

  const handleFile = async (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith('.txt') && !name.endsWith('.md')) {
      setError('Please choose a .txt or .md file.');
      return;
    }
    try {
      const contents = await file.text();
      setText(contents);
    } catch {
      setError('Could not read that file. Try pasting the text instead.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset the input so selecting the same file again re-triggers onChange
    e.target.value = '';
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      setError('Please paste a post or load a file first.');
      return;
    }
    if (trimmed.length < MIN_CHARS) {
      setError(
        `Post is too short — please add at least ${MIN_CHARS - trimmed.length} more character${
          MIN_CHARS - trimmed.length === 1 ? '' : 's'
        }.`
      );
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError(
        `Post is too long — please remove ${(trimmed.length - MAX_CHARS).toLocaleString()} character${
          trimmed.length - MAX_CHARS === 1 ? '' : 's'
        }.`
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) {
        setError('You are not signed in. Please sign in and try again.');
        return;
      }

      const response = await fetch('/api/blog-upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong uploading your post.');
      }

      // Success — reset and let the dashboard show the processing state.
      setText('');
      setIsSubmitting(false);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Error uploading post:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong uploading your post.');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload a Post</DialogTitle>
          <DialogDescription>
            Paste a blog post you wrote, or load a .txt/.md file. We&apos;ll analyze it in your own
            words that powers an avatar session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            className="border-border bg-background focus:ring-ring min-h-[240px] w-full resize-y rounded-md border p-3 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
            placeholder="Paste your blog post here..."
          />

          <div className="flex items-center justify-between gap-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={16} className="mr-2" />
                Load .txt / .md file
              </Button>
            </div>

            <span
              className={
                tooShort || tooLong ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'
              }
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
              {charCount === 0 && ` (min ${MIN_CHARS})`}
              {tooShort && ` — need at least ${MIN_CHARS}`}
              {tooLong && ' — too long'}
            </span>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || charCount < MIN_CHARS || tooLong}
          >
            {isSubmitting ? (
              <>
                <CircleNotch size={16} className="mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadSimple size={16} className="mr-2" />
                Upload Post
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
