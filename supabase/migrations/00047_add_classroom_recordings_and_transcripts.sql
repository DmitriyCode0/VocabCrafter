alter table public.tutor_student_classrooms
  add column if not exists recording_consent_status text not null default 'pending',
  add column if not exists recording_status text not null default 'idle',
  add column if not exists transcript_status text not null default 'idle',
  add column if not exists last_recording_started_at timestamptz,
  add column if not exists last_recording_ended_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_student_classrooms_recording_consent_status_check'
  ) then
    alter table public.tutor_student_classrooms
      add constraint tutor_student_classrooms_recording_consent_status_check
      check (recording_consent_status in ('pending', 'granted', 'declined'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_student_classrooms_recording_status_check'
  ) then
    alter table public.tutor_student_classrooms
      add constraint tutor_student_classrooms_recording_status_check
      check (recording_status in ('idle', 'ready', 'recording', 'processing', 'completed', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_student_classrooms_transcript_status_check'
  ) then
    alter table public.tutor_student_classrooms
      add constraint tutor_student_classrooms_transcript_status_check
      check (transcript_status in ('idle', 'processing', 'ready', 'failed'));
  end if;
end $$;

create table public.tutor_student_classroom_recordings (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.tutor_student_classrooms(id) on delete cascade,
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

create index tutor_student_classroom_recordings_classroom_idx
  on public.tutor_student_classroom_recordings(classroom_id, created_at desc);

alter table public.tutor_student_classroom_recordings enable row level security;

create policy "Participants can view classroom recordings"
  on public.tutor_student_classroom_recordings for select
  using (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_recordings.classroom_id
        and (
          connection.tutor_id = auth.uid()
          or connection.student_id = auth.uid()
        )
    )
  );

create policy "Tutors can manage classroom recordings"
  on public.tutor_student_classroom_recordings for all
  using (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_recordings.classroom_id
        and connection.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_recordings.classroom_id
        and connection.tutor_id = auth.uid()
    )
  );

create table public.tutor_student_classroom_transcripts (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null unique references public.tutor_student_classroom_recordings(id) on delete cascade,
  classroom_id uuid not null references public.tutor_student_classrooms(id) on delete cascade,
  language_code text,
  diarization_status text not null default 'pending'
    check (diarization_status in ('pending', 'processing', 'ready', 'failed')),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'reviewed')),
  full_text text,
  error_message text,
  active_evidence_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tutor_student_classroom_transcripts_classroom_idx
  on public.tutor_student_classroom_transcripts(classroom_id, created_at desc);

alter table public.tutor_student_classroom_transcripts enable row level security;

create policy "Participants can view classroom transcripts"
  on public.tutor_student_classroom_transcripts for select
  using (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_transcripts.classroom_id
        and (
          connection.tutor_id = auth.uid()
          or connection.student_id = auth.uid()
        )
    )
  );

create policy "Tutors can manage classroom transcripts"
  on public.tutor_student_classroom_transcripts for all
  using (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_transcripts.classroom_id
        and connection.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_transcripts.classroom_id
        and connection.tutor_id = auth.uid()
    )
  );

create table public.tutor_student_classroom_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.tutor_student_classroom_transcripts(id) on delete cascade,
  classroom_id uuid not null references public.tutor_student_classrooms(id) on delete cascade,
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
  constraint tutor_student_classroom_transcript_segments_content_not_blank
    check (btrim(content) <> ''),
  constraint tutor_student_classroom_transcript_segments_time_order
    check (
      ended_at_seconds is null
      or started_at_seconds is null
      or ended_at_seconds >= started_at_seconds
    )
);

create index tutor_student_classroom_transcript_segments_transcript_idx
  on public.tutor_student_classroom_transcript_segments(transcript_id, started_at_seconds asc nulls last);

create index tutor_student_classroom_transcript_segments_classroom_idx
  on public.tutor_student_classroom_transcript_segments(classroom_id, created_at desc);

alter table public.tutor_student_classroom_transcript_segments enable row level security;

create policy "Participants can view classroom transcript segments"
  on public.tutor_student_classroom_transcript_segments for select
  using (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_transcript_segments.classroom_id
        and (
          connection.tutor_id = auth.uid()
          or connection.student_id = auth.uid()
        )
    )
  );

create policy "Tutors can manage classroom transcript segments"
  on public.tutor_student_classroom_transcript_segments for all
  using (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_transcript_segments.classroom_id
        and connection.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_student_classrooms classroom
      join public.tutor_students connection
        on connection.id = classroom.connection_id
      where classroom.id = tutor_student_classroom_transcript_segments.classroom_id
        and connection.tutor_id = auth.uid()
    )
  );