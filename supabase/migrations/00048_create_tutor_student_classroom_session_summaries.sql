create table public.tutor_student_classroom_session_summaries (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.tutor_student_classrooms(id) on delete cascade,
  connection_id uuid not null references public.tutor_students(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  last_reported_by uuid references public.profiles(id) on delete set null,
  session_started_at timestamptz not null,
  session_ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  tutor_speaking_seconds integer not null default 0
    check (tutor_speaking_seconds >= 0),
  student_speaking_seconds integer not null default 0
    check (student_speaking_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_student_classroom_session_summaries_unique_session
    unique (classroom_id, session_started_at),
  constraint tutor_student_classroom_session_summaries_time_order
    check (
      session_ended_at is null
      or session_ended_at >= session_started_at
    )
);

create index tutor_student_classroom_session_summaries_classroom_idx
  on public.tutor_student_classroom_session_summaries(classroom_id, session_started_at desc);

create index tutor_student_classroom_session_summaries_connection_idx
  on public.tutor_student_classroom_session_summaries(connection_id, session_started_at desc);

alter table public.tutor_student_classroom_session_summaries enable row level security;

create policy "Participants can view classroom session summaries"
  on public.tutor_student_classroom_session_summaries for select
  using (
    exists (
      select 1
      from public.tutor_students connection
      where connection.id = tutor_student_classroom_session_summaries.connection_id
        and (
          connection.tutor_id = auth.uid()
          or connection.student_id = auth.uid()
        )
    )
  );

create policy "Tutors can manage classroom session summaries"
  on public.tutor_student_classroom_session_summaries for all
  using (
    exists (
      select 1
      from public.tutor_students connection
      where connection.id = tutor_student_classroom_session_summaries.connection_id
        and connection.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_students connection
      where connection.id = tutor_student_classroom_session_summaries.connection_id
        and connection.tutor_id = auth.uid()
    )
  );

comment on table public.tutor_student_classroom_session_summaries is
'Per-call classroom history, including persisted tutor and student speaking-time summaries.';