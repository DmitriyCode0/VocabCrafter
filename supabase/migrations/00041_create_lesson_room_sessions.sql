create table public.lesson_room_sessions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.tutor_student_lessons(id) on delete cascade,
  provider text not null default 'livekit',
  provider_room_key text not null unique,
  room_status text not null default 'scheduled'
    check (room_status in ('scheduled', 'open', 'live', 'completed', 'archived')),
  recording_consent_status text not null default 'pending'
    check (recording_consent_status in ('pending', 'granted', 'declined')),
  recording_status text not null default 'idle'
    check (recording_status in ('idle', 'ready', 'recording', 'processing', 'completed', 'failed')),
  transcript_status text not null default 'idle'
    check (transcript_status in ('idle', 'processing', 'ready', 'failed')),
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  last_recording_started_at timestamptz,
  last_recording_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_room_sessions_room_status_idx
  on public.lesson_room_sessions(room_status, created_at desc);

alter table public.lesson_room_sessions enable row level security;

create policy "Participants can view lesson room sessions"
  on public.lesson_room_sessions for select
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_sessions.lesson_id
        and (lesson.tutor_id = auth.uid() or lesson.student_id = auth.uid())
    )
  );

create policy "Tutors can create lesson room sessions"
  on public.lesson_room_sessions for insert
  with check (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_sessions.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  );

create policy "Tutors can update lesson room sessions"
  on public.lesson_room_sessions for update
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_sessions.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_sessions.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  );

create policy "Tutors can delete lesson room sessions"
  on public.lesson_room_sessions for delete
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_sessions.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  );

create table public.lesson_room_recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lesson_room_sessions(id) on delete cascade,
  lesson_id uuid not null references public.tutor_student_lessons(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  storage_bucket text,
  storage_path text,
  provider_recording_id text,
  status text not null default 'idle'
    check (status in ('idle', 'recording', 'processing', 'ready', 'failed', 'deleted')),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  consent_snapshot jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_room_recordings_lesson_idx
  on public.lesson_room_recordings(lesson_id, created_at desc);

create index lesson_room_recordings_session_idx
  on public.lesson_room_recordings(session_id, created_at desc);

alter table public.lesson_room_recordings enable row level security;

create policy "Participants can view lesson room recordings"
  on public.lesson_room_recordings for select
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_recordings.lesson_id
        and (lesson.tutor_id = auth.uid() or lesson.student_id = auth.uid())
    )
  );

create policy "Tutors can manage lesson room recordings"
  on public.lesson_room_recordings for all
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_recordings.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_recordings.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  );

create table public.lesson_room_transcripts (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null unique references public.lesson_room_recordings(id) on delete cascade,
  lesson_id uuid not null references public.tutor_student_lessons(id) on delete cascade,
  language_code text,
  diarization_status text not null default 'pending'
    check (diarization_status in ('pending', 'processing', 'ready', 'failed')),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'reviewed')),
  full_text text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_room_transcripts_lesson_idx
  on public.lesson_room_transcripts(lesson_id, created_at desc);

alter table public.lesson_room_transcripts enable row level security;

create policy "Participants can view lesson room transcripts"
  on public.lesson_room_transcripts for select
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_transcripts.lesson_id
        and (lesson.tutor_id = auth.uid() or lesson.student_id = auth.uid())
    )
  );

create policy "Tutors can manage lesson room transcripts"
  on public.lesson_room_transcripts for all
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_transcripts.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_transcripts.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  );

create table public.lesson_room_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.lesson_room_transcripts(id) on delete cascade,
  lesson_id uuid not null references public.tutor_student_lessons(id) on delete cascade,
  speaker_role text not null default 'unknown'
    check (speaker_role in ('tutor', 'student', 'unknown', 'system')),
  speaker_label text,
  started_at_seconds numeric(10, 2)
    check (started_at_seconds is null or started_at_seconds >= 0),
  ended_at_seconds numeric(10, 2)
    check (ended_at_seconds is null or ended_at_seconds >= 0),
  content text not null,
  confidence numeric(4, 3)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_room_transcript_segments_content_not_blank
    check (btrim(content) <> ''),
  constraint lesson_room_transcript_segments_time_order
    check (
      ended_at_seconds is null
      or started_at_seconds is null
      or ended_at_seconds >= started_at_seconds
    )
);

create index lesson_room_transcript_segments_transcript_idx
  on public.lesson_room_transcript_segments(transcript_id, started_at_seconds asc nulls last);

create index lesson_room_transcript_segments_lesson_idx
  on public.lesson_room_transcript_segments(lesson_id, created_at desc);

alter table public.lesson_room_transcript_segments enable row level security;

create policy "Participants can view lesson room transcript segments"
  on public.lesson_room_transcript_segments for select
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_transcript_segments.lesson_id
        and (lesson.tutor_id = auth.uid() or lesson.student_id = auth.uid())
    )
  );

create policy "Tutors can manage lesson room transcript segments"
  on public.lesson_room_transcript_segments for all
  using (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_transcript_segments.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_student_lessons lesson
      where lesson.id = lesson_room_transcript_segments.lesson_id
        and lesson.tutor_id = auth.uid()
    )
  );