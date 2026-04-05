create table public.student_progress_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  insights jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  constraint student_progress_insights_insights_is_object check (
    insights is null or jsonb_typeof(insights) = 'object'
  )
);

create index idx_student_progress_insights_user
  on public.student_progress_insights(user_id);

alter table public.student_progress_insights enable row level security;

create policy "Users can view own student progress insights"
  on public.student_progress_insights for select
  using (auth.uid() = user_id);

create policy "Users can create own student progress insights"
  on public.student_progress_insights for insert
  with check (auth.uid() = user_id);

create policy "Users can update own student progress insights"
  on public.student_progress_insights for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own student progress insights"
  on public.student_progress_insights for delete
  using (auth.uid() = user_id);

create policy "Superadmins can view all student progress insights"
  on public.student_progress_insights for select
  using (public.is_superadmin());