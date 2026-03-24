ALTER TABLE public.word_mastery
ADD COLUMN translation_correct_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.word_mastery
ADD CONSTRAINT word_mastery_translation_correct_count_check
CHECK (translation_correct_count >= 0);