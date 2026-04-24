alter table public.tutor_students
  add column if not exists plan_title text,
  add column if not exists goal_summary text,
  add column if not exists objectives jsonb not null default '[]'::jsonb,
  add column if not exists monthly_quiz_target integer,
  add column if not exists monthly_new_mastery_words_target integer,
  add column if not exists updated_at timestamptz not null default now();

alter table public.tutor_students
  add constraint tutor_students_plan_title_not_blank
  check (plan_title is null or btrim(plan_title) <> '');

alter table public.tutor_students
  add constraint tutor_students_goal_summary_not_blank
  check (goal_summary is null or btrim(goal_summary) <> '');

alter table public.tutor_students
  add constraint tutor_students_objectives_is_array
  check (jsonb_typeof(objectives) = 'array');

alter table public.tutor_students
  add constraint tutor_students_monthly_quiz_target_nonnegative
  check (monthly_quiz_target is null or monthly_quiz_target >= 0);

alter table public.tutor_students
  add constraint tutor_students_monthly_new_mastery_words_target_nonnegative
  check (
    monthly_new_mastery_words_target is null
    or monthly_new_mastery_words_target >= 0
  );

drop trigger if exists tutor_students_updated_at on public.tutor_students;

create trigger tutor_students_updated_at
  before update on public.tutor_students
  for each row
  execute function public.update_updated_at();

create table public.tutor_student_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  generated_by uuid references public.profiles(id) on delete set null,
  report_month date not null,
  period_start date not null,
  period_end date not null,
  generation_source text not null
    check (generation_source in ('manual', 'scheduled')),
  status text not null
    check (status in ('draft', 'published', 'failed', 'quota_blocked')),
  title text not null,
  ai_draft text,
  published_content text,
  tutor_addendum text,
  plan_snapshot jsonb not null default '{}'::jsonb,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  generation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint tutor_student_monthly_reports_period_range
    check (period_end >= period_start),
  constraint tutor_student_monthly_reports_title_not_blank
    check (btrim(title) <> ''),
  constraint tutor_student_monthly_reports_plan_snapshot_is_object
    check (jsonb_typeof(plan_snapshot) = 'object'),
  constraint tutor_student_monthly_reports_metrics_snapshot_is_object
    check (jsonb_typeof(metrics_snapshot) = 'object'),
  constraint tutor_student_monthly_reports_published_content_required
    check (status <> 'published' or published_content is not null),
  unique (tutor_id, student_id, report_month)
);

create index idx_tutor_student_monthly_reports_student
  on public.tutor_student_monthly_reports(student_id, report_month desc);

create index idx_tutor_student_monthly_reports_tutor
  on public.tutor_student_monthly_reports(tutor_id, report_month desc);

create index idx_tutor_student_monthly_reports_generated_by
  on public.tutor_student_monthly_reports(generated_by, generated_at desc);

create index idx_tutor_student_monthly_reports_status
  on public.tutor_student_monthly_reports(status, report_month desc);

create trigger tutor_student_monthly_reports_updated_at
  before update on public.tutor_student_monthly_reports
  for each row
  execute function public.update_updated_at();

alter table public.tutor_student_monthly_reports enable row level security;

create policy "Tutors can view connected student monthly reports"
  on public.tutor_student_monthly_reports for select
  using (
    public.is_superadmin()
    or exists (
      select 1 from public.tutor_students ts
      where ts.student_id = tutor_student_monthly_reports.student_id
        and ts.tutor_id = auth.uid()
        and ts.status = 'active'
    )
  );

create policy "Tutors can create connected student monthly reports"
  on public.tutor_student_monthly_reports for insert
  with check (
    public.is_superadmin()
    or (
      auth.uid() = tutor_id
      and (generated_by is null or generated_by = auth.uid())
      and exists (
        select 1 from public.tutor_students ts
        where ts.student_id = tutor_student_monthly_reports.student_id
          and ts.tutor_id = auth.uid()
          and ts.status = 'active'
      )
    )
  );

create policy "Tutors can update own student monthly reports"
  on public.tutor_student_monthly_reports for update
  using (public.is_superadmin() or auth.uid() = tutor_id)
  with check (public.is_superadmin() or auth.uid() = tutor_id);

create policy "Tutors can delete own student monthly reports"
  on public.tutor_student_monthly_reports for delete
  using (public.is_superadmin() or auth.uid() = tutor_id);

create policy "Students can view published own monthly reports"
  on public.tutor_student_monthly_reports for select
  using (auth.uid() = student_id and status = 'published');