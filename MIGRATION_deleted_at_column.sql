-- OPTIONAL Migration: Add deleted_at column to avatar_share_tokens table
-- 
-- Purpose: Track when sessions are deleted for auditing/debugging purposes.
-- 
-- NOTE: This migration is OPTIONAL. The session deletion feature works without it.
-- The feature relies on is_active=false to detect deleted sessions, which doesn't
-- require any schema changes.
--
-- If you want to track the exact timestamp when sessions were deleted, run this migration.

-- Add the deleted_at column (optional)
ALTER TABLE avatar_share_tokens
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN avatar_share_tokens.deleted_at IS 'Optional: Timestamp when the associated session was deleted. The is_active column is the primary mechanism for detecting deleted sessions.';

