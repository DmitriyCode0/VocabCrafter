-- Create word_mastery table for per-word spaced-repetition tracking
CREATE TABLE public.word_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT,
  mastery_level INTEGER NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one row per student per word
ALTER TABLE public.word_mastery ADD CONSTRAINT uq_word_mastery_student_term UNIQUE (student_id, term);

-- Enable RLS
ALTER TABLE public.word_mastery ENABLE ROW LEVEL SECURITY;

-- Students can read their own mastery rows
CREATE POLICY "Students can read own word mastery"
  ON public.word_mastery FOR SELECT
  USING (auth.uid() = student_id);

-- Service role (admin client) handles all writes

-- Indexes for common queries
CREATE INDEX idx_word_mastery_student_level ON public.word_mastery(student_id, mastery_level);
CREATE INDEX idx_word_mastery_student_review ON public.word_mastery(student_id, next_review);
CREATE INDEX idx_word_mastery_student ON public.word_mastery(student_id);
