ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS source_language TEXT NOT NULL DEFAULT 'ukrainian';

ALTER TABLE public.profiles
ALTER COLUMN preferred_language SET DEFAULT 'english';