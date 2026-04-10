create table public.google_calendar_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  google_email text,
  calendar_id text not null default 'primary',
  access_token text not null,
  refresh_token text not null,
  scope text,
  access_token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger google_calendar_connections_updated_at
  before update on public.google_calendar_connections
  for each row
  execute function public.update_updated_at();

alter table public.google_calendar_connections enable row level security;

create policy "Users can view own google calendar connection"
  on public.google_calendar_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own google calendar connection"
  on public.google_calendar_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own google calendar connection"
  on public.google_calendar_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own google calendar connection"
  on public.google_calendar_connections for delete
  using (auth.uid() = user_id);

create table public.lesson_google_calendar_events (
  lesson_id uuid primary key references public.tutor_student_lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  google_calendar_id text not null default 'primary',
  google_event_id text not null,
  synced_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_lesson_google_calendar_events_user_event
  on public.lesson_google_calendar_events(user_id, google_event_id);

create index idx_lesson_google_calendar_events_user
  on public.lesson_google_calendar_events(user_id, synced_at desc);

create trigger lesson_google_calendar_events_updated_at
  before update on public.lesson_google_calendar_events
  for each row
  execute function public.update_updated_at();

alter table public.lesson_google_calendar_events enable row level security;

create policy "Tutors can view own lesson google calendar events"
  on public.lesson_google_calendar_events for select
  using (auth.uid() = user_id);

create policy "Tutors can insert own lesson google calendar events"
  on public.lesson_google_calendar_events for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tutor_student_lessons lessons
      where lessons.id = lesson_google_calendar_events.lesson_id
        and lessons.tutor_id = auth.uid()
    )
  );

create policy "Tutors can update own lesson google calendar events"
  on public.lesson_google_calendar_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Tutors can delete own lesson google calendar events"
  on public.lesson_google_calendar_events for delete
  using (auth.uid() = user_id);