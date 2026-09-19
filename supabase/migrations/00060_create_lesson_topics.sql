create table public.lesson_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint lesson_topics_title_not_blank check (btrim(title) <> '')
);

insert into public.lesson_topics (title, sort_order)
values
  ('B1-B2 A Brief History of Emoji', 1),
  ('B1-B2 American Thanksgiving', 2),
  ('B1 Hidden Meanings of Famous Logos', 3),
  ('B1 Christmas Ads', 4)
on conflict (title) do nothing;

create table public.tutor_student_lesson_topics (
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.lesson_topics(id) on delete cascade,
  covered_at timestamptz not null default now(),
  primary key (tutor_id, student_id, topic_id)
);

create index idx_tutor_student_lesson_topics_student
  on public.tutor_student_lesson_topics(tutor_id, student_id);

alter table public.lesson_topics enable row level security;
alter table public.tutor_student_lesson_topics enable row level security;

create policy "Authenticated users can view lesson topics"
  on public.lesson_topics for select
  using (auth.uid() is not null);

create policy "Tutors can view own covered lesson topics"
  on public.tutor_student_lesson_topics for select
  using (auth.uid() = tutor_id);

create policy "Tutors can manage own covered lesson topics"
  on public.tutor_student_lesson_topics for all
  using (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);