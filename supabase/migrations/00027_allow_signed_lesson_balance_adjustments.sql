alter table public.tutor_student_balance_transactions
  drop constraint if exists tutor_student_balance_transactions_amount_cents_check;

alter table public.tutor_student_balance_transactions
  add constraint tutor_student_balance_transactions_amount_cents_nonzero
  check (amount_cents <> 0);