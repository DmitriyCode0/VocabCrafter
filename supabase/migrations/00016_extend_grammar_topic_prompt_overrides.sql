alter table public.grammar_topic_prompt_overrides
  add column if not exists display_name text,
  add column if not exists learning_language text,
  add column if not exists cefr_level text,
  add column if not exists evaluation_instructions text,
  add column if not exists is_custom boolean not null default false,
  add column if not exists is_archived boolean not null default false;

create unique index if not exists grammar_topic_prompt_overrides_display_name_language_idx
on public.grammar_topic_prompt_overrides (learning_language, display_name)
where display_name is not null and is_archived = false;

alter table public.grammar_topic_prompt_overrides
  add constraint grammar_topic_prompt_overrides_learning_language_check
  check (
    learning_language is null
    or learning_language in ('english', 'spanish')
  );

alter table public.grammar_topic_prompt_overrides
  add constraint grammar_topic_prompt_overrides_cefr_level_check
  check (
    cefr_level is null
    or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  );

alter table public.grammar_topic_prompt_overrides
  add constraint grammar_topic_prompt_overrides_custom_topic_requirements_check
  check (
    not is_custom
    or (
      display_name is not null
      and learning_language is not null
      and cefr_level is not null
      and rule_text is not null
    )
  );