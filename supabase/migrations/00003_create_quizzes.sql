-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'mcq', 'gap_fill', 'translation', 'text_translation',
    'translation_list', 'matching', 'flashcards', 'discussion'
  )),
  cefr_level TEXT NOT NULL,
  vocabulary_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  config JSONB,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_quizzes_creator ON public.quizzes(creator_id);
CREATE INDEX idx_quizzes_type ON public.quizzes(type);
CREATE INDEX idx_quizzes_created_at ON public.quizzes(created_at DESC);
