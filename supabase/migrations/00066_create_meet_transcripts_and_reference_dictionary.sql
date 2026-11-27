-- Reference EN/UK dictionary (Layer 1 for StarDict / offline lookup) and Google Meet lesson transcript AI analysis

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.reference_dictionary_entries (
  id uuid primary key default gen_random_uuid(),
  language_pair text not null default 'en-uk',
  headword text not null,
  normalized_headword text not null,
  item_type text not null default 'word' check (item_type in ('word', 'phrase')),
  part_of_speech text,
  ipa_us text,
  ipa_uk text,
  short_uk_translation text,
  senses jsonb not null default '[]'::jsonb,
  source_dict text not null default 'stardict',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_dictionary_entries_unique unique (language_pair, normalized_headword, item_type)
);

create index if not exists idx_ref_dict_headword_trgm
  on public.reference_dictionary_entries using gin (normalized_headword extensions.gin_trgm_ops);

create index if not exists idx_ref_dict_lang_headword
  on public.reference_dictionary_entries (language_pair, normalized_headword);

alter table public.reference_dictionary_entries enable row level security;

drop policy if exists "Authenticated users can read reference dictionary entries"
  on public.reference_dictionary_entries;

create policy "Authenticated users can read reference dictionary entries"
  on public.reference_dictionary_entries
  for select
  to authenticated
  using (true);

create table if not exists public.lesson_meet_transcripts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.tutor_student_lessons(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete set null,
  source_type text not null default 'google_drive' check (source_type in ('google_drive', 'manual_paste', 'file_upload')),
  google_drive_file_id text,
  google_drive_file_name text,
  google_drive_web_view_link text,
  raw_text text not null,
  parsed_segments jsonb not null default '[]'::jsonb,
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'analyzed', 'learning_approved', 'failed')),
  analysis_error text,
  lesson_summary_uk text,
  auto_applied_active jsonb not null default '[]'::jsonb,
  auto_applied_passive jsonb not null default '[]'::jsonb,
  learning_candidates jsonb not null default '[]'::jsonb,
  active_applied_count integer not null default 0,
  passive_applied_count integer not null default 0,
  learning_approved_count integer not null default 0,
  analyzed_at timestamptz,
  learning_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lesson_meet_transcripts_tutor_id
  on public.lesson_meet_transcripts (tutor_id);

create index if not exists idx_lesson_meet_transcripts_student_id
  on public.lesson_meet_transcripts (student_id)
  where student_id is not null;

create index if not exists idx_lesson_meet_transcripts_pending_learning
  on public.lesson_meet_transcripts (tutor_id)
  where analysis_status = 'analyzed';

alter table public.lesson_meet_transcripts enable row level security;

drop policy if exists "Tutors can manage own lesson meet transcripts"
  on public.lesson_meet_transcripts;

create policy "Tutors can manage own lesson meet transcripts"
  on public.lesson_meet_transcripts
  for all
  to authenticated
  using ((select auth.uid()) = tutor_id)
  with check ((select auth.uid()) = tutor_id);

drop policy if exists "Students can view own lesson meet transcripts"
  on public.lesson_meet_transcripts;

create policy "Students can view own lesson meet transcripts"
  on public.lesson_meet_transcripts
  for select
  to authenticated
  using ((select auth.uid()) = student_id);
