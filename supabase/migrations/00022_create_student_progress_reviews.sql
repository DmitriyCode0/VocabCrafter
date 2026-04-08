create table public.student_progress_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_progress_reviews_content_not_blank check (btrim(content) <> '')
);

create index idx_student_progress_reviews_student
  on public.student_progress_reviews(student_id, created_at desc);

create index idx_student_progress_reviews_tutor
  on public.student_progress_reviews(tutor_id, created_at desc);

alter table public.student_progress_reviews enable row level security;

create policy "Tutors can view connected student progress reviews"
  on public.student_progress_reviews for select
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.tutor_students ts
      where ts.student_id = student_progress_reviews.student_id
        and ts.tutor_id = auth.uid()
        and ts.status = 'active'
    )
  );

create policy "Tutors can create connected student progress reviews"
  on public.student_progress_reviews for insert
  with check (
    public.is_superadmin()
    or (
      auth.uid() = tutor_id
      and exists (
        select 1 from public.tutor_students ts
        where ts.student_id = student_progress_reviews.student_id
          and ts.tutor_id = auth.uid()
          and ts.status = 'active'
      )
    )
  );

create policy "Tutors can update own student progress reviews"
  on public.student_progress_reviews for update
  using (public.is_superadmin() or auth.uid() = tutor_id)
  with check (public.is_superadmin() or auth.uid() = tutor_id);

create policy "Tutors can delete own student progress reviews"
  on public.student_progress_reviews for delete
  using (public.is_superadmin() or auth.uid() = tutor_id);