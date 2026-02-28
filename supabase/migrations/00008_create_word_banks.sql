-- Create word_banks table
CREATE TABLE public.word_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.word_banks ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_word_banks_user ON public.word_banks(user_id);

-- RLS Policies

-- Users can create their own word banks
CREATE POLICY "Users can create own word banks"
  ON public.word_banks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own word banks
CREATE POLICY "Users can read own word banks"
  ON public.word_banks FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own word banks
CREATE POLICY "Users can update own word banks"
  ON public.word_banks FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own word banks
CREATE POLICY "Users can delete own word banks"
  ON public.word_banks FOR DELETE
  USING (user_id = auth.uid());

-- Superadmins can read all word banks
CREATE POLICY "Superadmins can read all word banks"
  ON public.word_banks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
