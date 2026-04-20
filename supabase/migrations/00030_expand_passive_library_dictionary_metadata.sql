alter table public.passive_vocabulary_library
  drop constraint if exists passive_vocabulary_library_part_of_speech_check;

alter table public.passive_vocabulary_library
  add constraint passive_vocabulary_library_part_of_speech_check
  check (
    part_of_speech in (
      'noun',
      'verb',
      'modal verb',
      'auxiliary',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'determiner',
      'interjection',
      'phrase',
      'other'
    )
  );

update public.passive_vocabulary_library
set part_of_speech = 'modal verb'
where item_type = 'word'
  and part_of_speech = 'verb'
  and normalized_term in (
    'can',
    'cannot',
    'could',
    'may',
    'might',
    'must',
    'shall',
    'should',
    'will',
    'would'
  );