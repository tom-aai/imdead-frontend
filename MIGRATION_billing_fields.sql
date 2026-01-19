-- Migration: Add billing fields to user_profiles table
-- 
-- Purpose: Support billing system with Stripe integration for pay-per-minute
-- usage after the free tier (1 hour/month) is exhausted.
--
-- Run this migration in your Supabase SQL editor before deploying billing features.

-- Add Stripe customer ID
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL;

-- Add Stripe subscription ID (null = free tier)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT DEFAULT NULL;

-- Add billing status: 'free', 'active', 'past_due', 'cancelled'
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'free';

-- Add admin flag for unlimited usage
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN user_profiles.stripe_subscription_id IS 'Active Stripe subscription ID. NULL means user is on free tier.';
COMMENT ON COLUMN user_profiles.billing_status IS 'Billing status: free, active, past_due, cancelled';
COMMENT ON COLUMN user_profiles.is_admin IS 'Admin flag - when true, user has unlimited usage';

-- Create index for efficient billing queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_billing_status ON user_profiles(billing_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON user_profiles(stripe_customer_id);
