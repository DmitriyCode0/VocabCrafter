-- Create passive_vocabulary_dictionary_editor_permissions table
create table if not exists public.passive_vocabulary_dictionary_editor_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  granted_by uuid references public.profiles(id) on delete set null on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique index
create unique index if not exists idx_passive_vocabulary_dictionary_editor_permissions_user_id
  on public.passive_vocabulary_dictionary_editor_permissions(user_id);

-- RLS
alter table public.passive_vocabulary_dictionary_editor_permissions enable row level security;

drop policy if exists "Superadmins can manage dictionary editor permissions" on public.passive_vocabulary_dictionary_editor_permissions;
create policy "Superadmins can manage dictionary editor permissions"
  on public.passive_vocabulary_dictionary_editor_permissions
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

-- Function for updated_at
drop trigger if exists set_updated_at on public.passive_vocabulary_dictionary_editor_permissions;
create trigger set_updated_at
  before update on public.passive_vocabulary_dictionary_editor_permissions
  for each row
  execute function public.set_current_timestamp_updated_at();

-- Update check constraints to add 'phrasal verb' and 'idiom' to part_of_speech
alter table public.passive_vocabulary_library
  drop constraint if exists passive_vocabulary_library_part_of_speech_check;
alter table public.passive_vocabulary_library
  add constraint passive_vocabulary_library_part_of_speech_check
  check (
    part_of_speech in (
      'noun',
      'verb',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'determiner',
      'interjection',
      'phrase',
      'other',
      'modal verb',
      'auxiliary',
      'phrasal verb',
      'idiom'
    )
  );

alter table public.passive_vocabulary_library_suggestions
  drop constraint if exists passive_vocabulary_library_suggestions_proposed_part_of_speech_check;
alter table public.passive_vocabulary_library_suggestions
  add constraint passive_vocabulary_library_suggestions_proposed_part_of_speech_check
  check (
    proposed_part_of_speech in (
      'noun',
      'verb',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'determiner',
      'interjection',
      'phrase',
      'other',
      'modal verb',
      'auxiliary',
      'phrasal verb',
      'idiom'
    )
  );
