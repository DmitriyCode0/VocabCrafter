alter table public.student_vocabulary_items
  add column if not exists group_override text
  check (group_override in ('passive_only', 'active_and_passive'));

alter table public.student_vocabulary_items
  add column if not exists custom_definition text;

alter table public.student_vocabulary_items
  drop constraint if exists student_vocabulary_items_custom_definition_not_blank;

alter table public.student_vocabulary_items
  add constraint student_vocabulary_items_custom_definition_not_blank
  check (
    custom_definition is null or btrim(custom_definition) <> ''
  );

create index if not exists student_vocabulary_items_student_group_override_idx
  on public.student_vocabulary_items(student_id, group_override);