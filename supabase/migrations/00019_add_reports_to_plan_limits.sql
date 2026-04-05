alter table public.plan_limits
  add column if not exists reports_per_month integer check (reports_per_month >= 0);

update public.plan_limits
set reports_per_month = case key
  when 'free' then 0
  when 'pro' then 20
  when 'premium' then 80
  else reports_per_month
end
where reports_per_month is null;
