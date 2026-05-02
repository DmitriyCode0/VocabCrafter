create table public.tutor_student_monthly_plans (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.tutor_students(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan_month date not null,
  plan_title text,
  goal_summary text,
  objectives jsonb not null default '[]'::jsonb,
  grammar_topic_keys jsonb not null default '[]'::jsonb,
  report_language text not null default 'uk',
  monthly_sentence_translation_target integer,
  monthly_gap_fill_target integer,
  monthly_completed_lessons_target integer,
  monthly_words_added_target integer,
  monthly_mastered_words_target integer,
  monthly_student_speaking_share_target numeric(5,2),
  monthly_average_score_target numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_student_monthly_plans_plan_title_not_blank
    check (plan_title is null or btrim(plan_title) <> ''),
  constraint tutor_student_monthly_plans_goal_summary_not_blank
    check (goal_summary is null or btrim(goal_summary) <> ''),
  constraint tutor_student_monthly_plans_objectives_is_array
    check (jsonb_typeof(objectives) = 'array'),
  constraint tutor_student_monthly_plans_grammar_topic_keys_is_array
    check (jsonb_typeof(grammar_topic_keys) = 'array'),
  constraint tutor_student_monthly_plans_report_language_valid
    check (report_language in ('uk', 'en')),
  constraint tutor_student_monthly_plans_sentence_target_nonnegative
    check (
      monthly_sentence_translation_target is null
      or monthly_sentence_translation_target >= 0
    ),
  constraint tutor_student_monthly_plans_gap_fill_target_nonnegative
    check (
      monthly_gap_fill_target is null
      or monthly_gap_fill_target >= 0
    ),
  constraint tutor_student_monthly_plans_lessons_target_nonnegative
    check (
      monthly_completed_lessons_target is null
      or monthly_completed_lessons_target >= 0
    ),
  constraint tutor_student_monthly_plans_words_added_target_nonnegative
    check (
      monthly_words_added_target is null
      or monthly_words_added_target >= 0
    ),
  constraint tutor_student_monthly_plans_mastered_words_target_nonnegative
    check (
      monthly_mastered_words_target is null
      or monthly_mastered_words_target >= 0
    ),
  constraint tutor_student_monthly_plans_speaking_share_target_range
    check (
      monthly_student_speaking_share_target is null
      or (
        monthly_student_speaking_share_target >= 0
        and monthly_student_speaking_share_target <= 100
      )
    ),
  constraint tutor_student_monthly_plans_average_score_target_range
    check (
      monthly_average_score_target is null
      or (
        monthly_average_score_target >= 0
        and monthly_average_score_target <= 100
      )
    ),
  unique (tutor_id, student_id, plan_month)
);

create index idx_tutor_student_monthly_plans_student_month
  on public.tutor_student_monthly_plans(student_id, plan_month desc);

create index idx_tutor_student_monthly_plans_tutor_month
  on public.tutor_student_monthly_plans(tutor_id, plan_month desc);

create trigger tutor_student_monthly_plans_updated_at
  before update on public.tutor_student_monthly_plans
  for each row
  execute function public.update_updated_at();

alter table public.tutor_student_monthly_plans enable row level security;

create policy "Tutors can view monthly plans for connected students"
  on public.tutor_student_monthly_plans for select
  using (
    public.is_superadmin()
    or exists (
      select 1
      from public.tutor_students ts
      where ts.id = tutor_student_monthly_plans.connection_id
        and ts.tutor_id = auth.uid()
        and ts.status = 'active'
    )
  );

create policy "Tutors can create monthly plans for connected students"
  on public.tutor_student_monthly_plans for insert
  with check (
    public.is_superadmin()
    or (
      tutor_id = auth.uid()
      and exists (
        select 1
        from public.tutor_students ts
        where ts.id = tutor_student_monthly_plans.connection_id
          and ts.tutor_id = auth.uid()
          and ts.student_id = tutor_student_monthly_plans.student_id
          and ts.status = 'active'
      )
    )
  );

create policy "Tutors can update monthly plans for connected students"
  on public.tutor_student_monthly_plans for update
  using (public.is_superadmin() or tutor_id = auth.uid())
  with check (public.is_superadmin() or tutor_id = auth.uid());

create policy "Tutors can delete monthly plans for connected students"
  on public.tutor_student_monthly_plans for delete
  using (public.is_superadmin() or tutor_id = auth.uid());

insert into public.tutor_student_monthly_plans (
  connection_id,
  tutor_id,
  student_id,
  plan_month,
  plan_title,
  goal_summary,
  objectives,
  grammar_topic_keys,
  report_language,
  monthly_sentence_translation_target,
  monthly_gap_fill_target,
  monthly_completed_lessons_target,
  monthly_words_added_target,
  monthly_mastered_words_target,
  monthly_average_score_target
)
select
  ts.id,
  ts.tutor_id,
  ts.student_id,
  date_trunc('month', timezone('utc', now()))::date,
  ts.plan_title,
  ts.goal_summary,
  ts.objectives,
  ts.grammar_topic_keys,
  ts.report_language,
  ts.monthly_sentence_translation_target,
  ts.monthly_gap_fill_target,
  ts.monthly_completed_lessons_target,
  ts.monthly_new_mastery_words_target,
  ts.monthly_new_mastery_words_target,
  ts.monthly_average_score_target
from public.tutor_students ts
where ts.status = 'active'
on conflict (tutor_id, student_id, plan_month) do nothing;
