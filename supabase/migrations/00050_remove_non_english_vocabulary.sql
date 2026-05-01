-- Clean up non-English words from passive vocabulary library
-- This removes entries with Cyrillic, Greek, and other non-Latin scripts

-- Create temporary function to detect non-English text
create or replace function is_non_english_text(text_value text)
returns boolean as $$
begin
  -- Check for Cyrillic (Ukrainian, Russian, Bulgarian, etc.)
  if text_value ~ '[А-Яа-яЁё]' then
    return true;
  end if;
  
  -- Check for Greek
  if text_value ~ '[Α-Ωα-ω]' then
    return true;
  end if;
  
  -- Check for Arabic and other non-Latin scripts
  if text_value ~ '[^\x00-\x7F]' then
    return true;
  end if;
  
  return false;
end;
$$ language plpgsql immutable;

-- Count non-English entries before deletion
do $$
declare
  non_english_count int;
begin
  select count(*) into non_english_count
  from public.passive_vocabulary_library
  where is_non_english_text(canonical_term);
  
  raise notice 'Found % non-English entries to delete', non_english_count;
end $$;

-- Delete non-English entries (this will cascade to forms and other related data)
delete from public.passive_vocabulary_library
where is_non_english_text(canonical_term);

-- Clean up temporary function
drop function if exists is_non_english_text(text);
