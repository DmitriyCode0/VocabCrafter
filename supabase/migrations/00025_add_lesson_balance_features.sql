alter table public.tutor_students
  add column lesson_price_cents integer not null default 0;

alter table public.tutor_students
  add constraint tutor_students_lesson_price_cents_nonnegative
  check (lesson_price_cents >= 0);

alter table public.tutor_student_lessons
  add column price_cents integer not null default 0;

update public.tutor_student_lessons lessons
set price_cents = coalesce(ts.lesson_price_cents, 0)
from public.tutor_students ts
where ts.tutor_id = lessons.tutor_id
  and ts.student_id = lessons.student_id;

alter table public.tutor_student_lessons
  add constraint tutor_student_lessons_price_cents_nonnegative
  check (price_cents >= 0);

create table public.tutor_student_balance_transactions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  note text,
  created_at timestamptz not null default now()
);

create index idx_tutor_student_balance_transactions_pair
  on public.tutor_student_balance_transactions(tutor_id, student_id, created_at desc);

create index idx_tutor_student_balance_transactions_student
  on public.tutor_student_balance_transactions(student_id, created_at desc);

alter table public.tutor_student_balance_transactions enable row level security;

create policy "Tutors can view own lesson balance transactions"
  on public.tutor_student_balance_transactions for select
  using (auth.uid() = tutor_id);

create policy "Students can view own lesson balance transactions"
  on public.tutor_student_balance_transactions for select
  using (auth.uid() = student_id);

create policy "Tutors can create own lesson balance transactions"
  on public.tutor_student_balance_transactions for insert
  with check (
    auth.uid() = tutor_id
    and created_by = auth.uid()
    and exists (
      select 1 from public.tutor_students ts
      where ts.tutor_id = tutor_student_balance_transactions.tutor_id
        and ts.student_id = tutor_student_balance_transactions.student_id
        and ts.status = 'active'
    )
  );

create policy "Superadmins can view all lesson balance transactions"
  on public.tutor_student_balance_transactions for select
  using (public.is_superadmin());