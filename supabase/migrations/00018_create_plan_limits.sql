create table public.plan_limits (
  key text primary key check (key in ('free', 'pro', 'premium')),
  price integer not null check (price >= 0),
  ai_calls_per_month integer not null check (ai_calls_per_month >= 0),
  quizzes_per_month integer check (quizzes_per_month >= 0),
  attempts_per_month integer check (attempts_per_month >= 0),
  word_banks integer check (word_banks >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.plan_limits (
  key,
  price,
  ai_calls_per_month,
  quizzes_per_month,
  attempts_per_month,
  word_banks
)
values
  ('free', 0, 500, 30, 100, 5),
  ('pro', 9, 3000, 200, 1000, 50),
  ('premium', 24, 15000, null, null, null)
on conflict (key) do nothing;

alter table public.plan_limits enable row level security;