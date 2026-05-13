alter table public.quizzes
add column deleted_at timestamptz;

create index idx_quizzes_deleted_at on public.quizzes(deleted_at);

alter table public.quiz_attempts
add column quiz_snapshot jsonb;

update public.quiz_attempts qa
set quiz_snapshot = jsonb_build_object(
  'title', q.title,
  'type', q.type,
  'cefr_level', q.cefr_level,
  'vocabulary_terms', q.vocabulary_terms,
  'generated_content', q.generated_content,
  'config', q.config
)
from public.quizzes q
where q.id = qa.quiz_id
  and qa.quiz_snapshot is null;