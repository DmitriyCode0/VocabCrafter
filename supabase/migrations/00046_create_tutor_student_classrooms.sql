create table public.tutor_student_classrooms (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.tutor_students(id) on delete cascade,
  provider text not null default 'livekit',
  provider_room_key text not null unique,
  room_status text not null default 'open'
    check (room_status in ('open', 'live', 'completed', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tutor_student_classrooms_room_status_idx
  on public.tutor_student_classrooms(room_status, updated_at desc);

alter table public.tutor_student_classrooms enable row level security;

create policy "Participants can view tutor student classrooms"
  on public.tutor_student_classrooms for select
  using (
    exists (
      select 1
      from public.tutor_students connection
      where connection.id = tutor_student_classrooms.connection_id
        and (connection.tutor_id = auth.uid() or connection.student_id = auth.uid())
    )
  );

create policy "Tutors can manage tutor student classrooms"
  on public.tutor_student_classrooms for all
  using (
    exists (
      select 1
      from public.tutor_students connection
      where connection.id = tutor_student_classrooms.connection_id
        and connection.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_students connection
      where connection.id = tutor_student_classrooms.connection_id
        and connection.tutor_id = auth.uid()
    )
  );

comment on table public.tutor_student_classrooms is
'Persistent LiveKit classroom records bound to active tutor-student connections.';

comment on column public.tutor_student_classrooms.connection_id is
'Active tutor-student connection that owns this classroom.';