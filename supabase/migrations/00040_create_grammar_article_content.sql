create or replace function public.is_tutor_or_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('tutor', 'superadmin')
  );
$$;

create table public.grammar_article_editor_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger grammar_article_editor_permissions_updated_at
  before update on public.grammar_article_editor_permissions
  for each row
  execute function public.update_updated_at();

alter table public.grammar_article_editor_permissions enable row level security;

create policy "Users can view own grammar article editor permission"
  on public.grammar_article_editor_permissions for select
  using (auth.uid() = user_id or public.is_superadmin());

create policy "Superadmins can insert grammar article editor permissions"
  on public.grammar_article_editor_permissions for insert
  with check (public.is_superadmin());

create policy "Superadmins can update grammar article editor permissions"
  on public.grammar_article_editor_permissions for update
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "Superadmins can delete grammar article editor permissions"
  on public.grammar_article_editor_permissions for delete
  using (public.is_superadmin());

create or replace function public.can_edit_grammar_articles()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_superadmin()
    or exists (
      select 1 from public.grammar_article_editor_permissions
      where user_id = auth.uid()
    );
$$;

create table public.grammar_topic_library_contents (
  topic_key text primary key,
  draft_content jsonb,
  published_content jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  last_draft_saved_by uuid references public.profiles(id) on delete set null,
  last_published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint grammar_topic_library_contents_draft_content_is_object
    check (draft_content is null or jsonb_typeof(draft_content) = 'object'),
  constraint grammar_topic_library_contents_published_content_is_object
    check (
      published_content is null or jsonb_typeof(published_content) = 'object'
    )
);

create index idx_grammar_topic_library_contents_last_draft_saved_by
  on public.grammar_topic_library_contents(last_draft_saved_by);

create index idx_grammar_topic_library_contents_last_published_by
  on public.grammar_topic_library_contents(last_published_by);

create trigger grammar_topic_library_contents_updated_at
  before update on public.grammar_topic_library_contents
  for each row
  execute function public.update_updated_at();

alter table public.grammar_topic_library_contents enable row level security;

create policy "Tutors and superadmins can view grammar topic library contents"
  on public.grammar_topic_library_contents for select
  using (public.is_tutor_or_superadmin());

create policy "Authorized users can insert grammar topic library contents"
  on public.grammar_topic_library_contents for insert
  with check (public.can_edit_grammar_articles());

create policy "Authorized users can update grammar topic library contents"
  on public.grammar_topic_library_contents for update
  using (public.can_edit_grammar_articles())
  with check (public.can_edit_grammar_articles());

create policy "Superadmins can delete grammar topic library contents"
  on public.grammar_topic_library_contents for delete
  using (public.is_superadmin());