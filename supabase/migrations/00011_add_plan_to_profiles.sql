-- Add plan and AI usage tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'premium'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_calls_this_month integer NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_calls_reset_at timestamptz NOT NULL DEFAULT date_trunc('month', now());

-- Set all existing users to free plan
UPDATE profiles
SET plan = 'free',
    ai_calls_this_month = 0,
    ai_calls_reset_at = date_trunc('month', now())
WHERE plan IS NULL OR plan = 'free';
