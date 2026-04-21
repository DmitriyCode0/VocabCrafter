ALTER TABLE public.quiz_attempts
ADD COLUMN time_spent_seconds INTEGER NOT NULL DEFAULT 0
CHECK (time_spent_seconds >= 0);