create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null,
  request_type text not null check (request_type in ('text', 'tts')),
  provider text not null default 'gemini',
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  response_tokens integer not null default 0 check (response_tokens >= 0),
  audio_output_tokens integer not null default 0 check (audio_output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  is_estimated boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);

create index ai_usage_events_request_type_created_at_idx
  on public.ai_usage_events (request_type, created_at desc);

alter table public.ai_usage_events enable row level security;