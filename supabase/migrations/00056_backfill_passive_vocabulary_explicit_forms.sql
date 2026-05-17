insert into public.passive_vocabulary_library_forms (
  library_item_id,
  form_term,
  normalized_form,
  item_type,
  is_canonical,
  updated_at
)
select distinct
  library.id,
  trimmed_form,
  lower(
    regexp_replace(
      replace(replace(replace(trimmed_form, '’', ''''), 'ʼ', ''''), '`', ''''),
      '\s+',
      ' ',
      'g'
    )
  ),
  library.item_type,
  false,
  now()
from public.passive_vocabulary_library as library
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(library.attributes -> 'forms') = 'array'
      then library.attributes -> 'forms'
    else '[]'::jsonb
  end
) as explicit_form(raw_form)
cross join lateral (
  select nullif(btrim(explicit_form.raw_form), '') as trimmed_form
) as normalized_explicit_form
where trimmed_form is not null
  and lower(
    regexp_replace(
      replace(replace(replace(trimmed_form, '’', ''''), 'ʼ', ''''), '`', ''''),
      '\s+',
      ' ',
      'g'
    )
  ) <> library.normalized_term
on conflict (normalized_form, item_type) do nothing;