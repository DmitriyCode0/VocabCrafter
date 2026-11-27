-- Performance optimization: cover unindexed foreign keys and cache auth.<fn>() calls in RLS initplans

-- 1. Covering indexes for unindexed foreign keys
create index if not exists idx_ai_usage_events_user_id on public.ai_usage_events (user_id);
create index if not exists idx_assignments_quiz_id on public.assignments (quiz_id);
create index if not exists idx_classes_tutor_id on public.classes (tutor_id);
create index if not exists idx_grammar_article_editor_permissions_granted_by on public.grammar_article_editor_permissions (granted_by);
create index if not exists idx_grammar_topic_library_contents_created_by on public.grammar_topic_library_contents (created_by);
create index if not exists idx_grammar_topic_prompt_overrides_updated_by on public.grammar_topic_prompt_overrides (updated_by);
create index if not exists idx_lesson_room_recordings_created_by on public.lesson_room_recordings (created_by);
create index if not exists idx_lesson_room_sessions_created_by on public.lesson_room_sessions (created_by);
create index if not exists idx_pv_dict_editor_perms_granted_by on public.passive_vocabulary_dictionary_editor_permissions (granted_by);
create index if not exists idx_passive_vocabulary_evidence_imported_by on public.passive_vocabulary_evidence (imported_by);
create index if not exists idx_passive_vocabulary_library_reviewed_by on public.passive_vocabulary_library (reviewed_by);
create index if not exists idx_student_grammar_topic_mastery_tutor_id on public.student_grammar_topic_mastery (tutor_id);
create index if not exists idx_student_vocabulary_items_library_item_id on public.student_vocabulary_items (library_item_id);
create index if not exists idx_balance_transactions_created_by on public.tutor_student_balance_transactions (created_by);
create index if not exists idx_classroom_recordings_created_by on public.tutor_student_classroom_recordings (created_by);
create index if not exists idx_classroom_summaries_created_by on public.tutor_student_classroom_session_summaries (created_by);
create index if not exists idx_classroom_summaries_last_reported_by on public.tutor_student_classroom_session_summaries (last_reported_by);
create index if not exists idx_tutor_student_classrooms_created_by on public.tutor_student_classrooms (created_by);
create index if not exists idx_tutor_student_lesson_library_student_id on public.tutor_student_lesson_library (student_id);
create index if not exists idx_tutor_student_lesson_topics_student_id on public.tutor_student_lesson_topics (student_id);
create index if not exists idx_tutor_student_lesson_topics_topic_id on public.tutor_student_lesson_topics (topic_id);
create index if not exists idx_tutor_student_monthly_plans_connection_id on public.tutor_student_monthly_plans (connection_id);
create index if not exists idx_word_banks_user_id on public.word_banks (user_id);

-- 2. Wrap auth.uid() / auth.role() / auth.jwt() in (select ...) across existing RLS policies
alter policy "Students can delete own active vocabulary evidence" on public."active_vocabulary_evidence" using ((student_id = (select auth.uid())));
alter policy "Students can insert own active vocabulary evidence" on public."active_vocabulary_evidence" with check ((student_id = (select auth.uid())));
alter policy "Students can update own active vocabulary evidence" on public."active_vocabulary_evidence" using ((student_id = (select auth.uid()))) with check ((student_id = (select auth.uid())));
alter policy "Students can view own active vocabulary evidence" on public."active_vocabulary_evidence" using ((student_id = (select auth.uid())));
alter policy "Tutors and superadmins can delete active vocabulary evidence" on public."active_vocabulary_evidence" using ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students
  WHERE ((tutor_students.student_id = active_vocabulary_evidence.student_id) AND (tutor_students.tutor_id = (select auth.uid())) AND (tutor_students.status = 'active'::text))))));
alter policy "Tutors and superadmins can insert active vocabulary evidence" on public."active_vocabulary_evidence" with check ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students
  WHERE ((tutor_students.student_id = active_vocabulary_evidence.student_id) AND (tutor_students.tutor_id = (select auth.uid())) AND (tutor_students.status = 'active'::text))))));
alter policy "Tutors and superadmins can update active vocabulary evidence" on public."active_vocabulary_evidence" using ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students
  WHERE ((tutor_students.student_id = active_vocabulary_evidence.student_id) AND (tutor_students.tutor_id = (select auth.uid())) AND (tutor_students.status = 'active'::text)))))) with check ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students
  WHERE ((tutor_students.student_id = active_vocabulary_evidence.student_id) AND (tutor_students.tutor_id = (select auth.uid())) AND (tutor_students.status = 'active'::text))))));
alter policy "Tutors and superadmins can view active vocabulary evidence" on public."active_vocabulary_evidence" using ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students
  WHERE ((tutor_students.student_id = active_vocabulary_evidence.student_id) AND (tutor_students.tutor_id = (select auth.uid())) AND (tutor_students.status = 'active'::text))))));
alter policy "Tutors can manage own assignments" on public."assignments" using ((tutor_id = (select auth.uid()))) with check ((tutor_id = (select auth.uid())));
alter policy "Students can join classes" on public."class_members" with check (((select auth.uid()) = student_id));
alter policy "Students can leave classes" on public."class_members" using ((student_id = (select auth.uid())));
alter policy "Students can read own memberships" on public."class_members" using ((student_id = (select auth.uid())));
alter policy "Tutors can view class rosters" on public."class_members" using ((EXISTS ( SELECT 1
   FROM classes c
  WHERE ((c.id = class_members.class_id) AND (c.tutor_id = (select auth.uid()))))));
alter policy "Tutors can CRUD own classes" on public."classes" using ((tutor_id = (select auth.uid()))) with check ((tutor_id = (select auth.uid())));
alter policy "Students can read feedback on attempts" on public."feedback" using ((EXISTS ( SELECT 1
   FROM quiz_attempts qa
  WHERE ((qa.id = feedback.attempt_id) AND (qa.student_id = (select auth.uid()))))));
alter policy "Tutors can manage feedback" on public."feedback" using ((tutor_id = (select auth.uid()))) with check ((tutor_id = (select auth.uid())));
alter policy "Users can delete own google calendar connection" on public."google_calendar_connections" using (((select auth.uid()) = user_id));
alter policy "Users can insert own google calendar connection" on public."google_calendar_connections" with check (((select auth.uid()) = user_id));
alter policy "Users can update own google calendar connection" on public."google_calendar_connections" using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Users can view own google calendar connection" on public."google_calendar_connections" using (((select auth.uid()) = user_id));
alter policy "Users can view own grammar article editor permission" on public."grammar_article_editor_permissions" using ((((select auth.uid()) = user_id) OR is_superadmin()));
alter policy "Superadmins can delete grammar topic prompt overrides" on public."grammar_topic_prompt_overrides" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can insert grammar topic prompt overrides" on public."grammar_topic_prompt_overrides" with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can update grammar topic prompt overrides" on public."grammar_topic_prompt_overrides" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can view grammar topic prompt overrides" on public."grammar_topic_prompt_overrides" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Tutors can delete own lesson google calendar events" on public."lesson_google_calendar_events" using (((select auth.uid()) = user_id));
alter policy "Tutors can insert own lesson google calendar events" on public."lesson_google_calendar_events" with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM tutor_student_lessons lessons
  WHERE ((lessons.id = lesson_google_calendar_events.lesson_id) AND (lessons.tutor_id = (select auth.uid())))))));
alter policy "Tutors can update own lesson google calendar events" on public."lesson_google_calendar_events" using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Tutors can view own lesson google calendar events" on public."lesson_google_calendar_events" using (((select auth.uid()) = user_id));
alter policy "Participants can view lesson room recordings" on public."lesson_room_recordings" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_recordings.lesson_id) AND ((lesson.tutor_id = (select auth.uid())) OR (lesson.student_id = (select auth.uid())))))));
alter policy "Tutors can manage lesson room recordings" on public."lesson_room_recordings" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_recordings.lesson_id) AND (lesson.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_recordings.lesson_id) AND (lesson.tutor_id = (select auth.uid()))))));
alter policy "Participants can view lesson room sessions" on public."lesson_room_sessions" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_sessions.lesson_id) AND ((lesson.tutor_id = (select auth.uid())) OR (lesson.student_id = (select auth.uid())))))));
alter policy "Tutors can create lesson room sessions" on public."lesson_room_sessions" with check ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_sessions.lesson_id) AND (lesson.tutor_id = (select auth.uid()))))));
alter policy "Tutors can delete lesson room sessions" on public."lesson_room_sessions" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_sessions.lesson_id) AND (lesson.tutor_id = (select auth.uid()))))));
alter policy "Tutors can update lesson room sessions" on public."lesson_room_sessions" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_sessions.lesson_id) AND (lesson.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_sessions.lesson_id) AND (lesson.tutor_id = (select auth.uid()))))));
alter policy "Participants can view lesson room transcript segments" on public."lesson_room_transcript_segments" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_transcript_segments.lesson_id) AND ((lesson.tutor_id = (select auth.uid())) OR (lesson.student_id = (select auth.uid())))))));
alter policy "Tutors can manage lesson room transcript segments" on public."lesson_room_transcript_segments" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_transcript_segments.lesson_id) AND (lesson.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_transcript_segments.lesson_id) AND (lesson.tutor_id = (select auth.uid()))))));
alter policy "Participants can view lesson room transcripts" on public."lesson_room_transcripts" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_transcripts.lesson_id) AND ((lesson.tutor_id = (select auth.uid())) OR (lesson.student_id = (select auth.uid())))))));
alter policy "Tutors can manage lesson room transcripts" on public."lesson_room_transcripts" using ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_transcripts.lesson_id) AND (lesson.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM tutor_student_lessons lesson
  WHERE ((lesson.id = lesson_room_transcripts.lesson_id) AND (lesson.tutor_id = (select auth.uid()))))));
alter policy "Authenticated users can view lesson topics" on public."lesson_topics" using (((select auth.uid()) IS NOT NULL));
alter policy "Superadmins can manage dictionary editor permissions" on public."passive_vocabulary_dictionary_editor_permissions" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Users can delete own passive vocabulary evidence" on public."passive_vocabulary_evidence" using (((select auth.uid()) = student_id));
alter policy "Users can insert own passive vocabulary evidence" on public."passive_vocabulary_evidence" with check (((select auth.uid()) = student_id));
alter policy "Users can update own passive vocabulary evidence" on public."passive_vocabulary_evidence" using (((select auth.uid()) = student_id)) with check (((select auth.uid()) = student_id));
alter policy "Users can view own passive vocabulary evidence" on public."passive_vocabulary_evidence" using (((select auth.uid()) = student_id));
alter policy "Superadmins can delete passive vocabulary library" on public."passive_vocabulary_library" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can insert passive vocabulary library" on public."passive_vocabulary_library" with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can update passive vocabulary library" on public."passive_vocabulary_library" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can view passive vocabulary library" on public."passive_vocabulary_library" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can delete passive vocabulary library forms" on public."passive_vocabulary_library_forms" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can insert passive vocabulary library forms" on public."passive_vocabulary_library_forms" with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can update passive vocabulary library forms" on public."passive_vocabulary_library_forms" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can view passive vocabulary library forms" on public."passive_vocabulary_library_forms" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can delete passive vocabulary Ukrainian forms" on public."passive_vocabulary_library_ukrainian_forms" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can insert passive vocabulary Ukrainian forms" on public."passive_vocabulary_library_ukrainian_forms" with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can update passive vocabulary Ukrainian forms" on public."passive_vocabulary_library_ukrainian_forms" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Superadmins can view passive vocabulary Ukrainian forms" on public."passive_vocabulary_library_ukrainian_forms" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Tutors can read connected student profiles" on public."profiles" using ((EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = profiles.id) AND (ts.status = 'active'::text)))));
alter policy "Users can read own profile" on public."profiles" using (((select auth.uid()) = id));
alter policy "Users can update own profile" on public."profiles" using (((select auth.uid()) = id)) with check (((select auth.uid()) = id));
alter policy "Students can create attempts" on public."quiz_attempts" with check (((select auth.uid()) = student_id));
alter policy "Students can read own attempts" on public."quiz_attempts" using ((student_id = (select auth.uid())));
alter policy "Tutors can view connected student attempts" on public."quiz_attempts" using ((EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = quiz_attempts.student_id) AND (ts.status = 'active'::text)))));
alter policy "Tutors can view connected student quizzes" on public."quizzes" using ((EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = quizzes.creator_id) AND (ts.status = 'active'::text)))));
alter policy "Users can CRUD own quizzes" on public."quizzes" using ((creator_id = (select auth.uid()))) with check ((creator_id = (select auth.uid())));
alter policy "Students can view own grammar topic mastery" on public."student_grammar_topic_mastery" using (((select auth.uid()) = student_id));
alter policy "Superadmins full access to grammar topic mastery" on public."student_grammar_topic_mastery" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'superadmin'::text)))));
alter policy "Tutors can delete own grammar topic mastery" on public."student_grammar_topic_mastery" using (((source = 'tutor'::text) AND (tutor_id = (select auth.uid()))));
alter policy "Tutors can insert grammar topic mastery" on public."student_grammar_topic_mastery" with check (((source = 'tutor'::text) AND (tutor_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['tutor'::text, 'superadmin'::text])))))));
alter policy "Tutors can view student grammar topic mastery" on public."student_grammar_topic_mastery" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['tutor'::text, 'superadmin'::text]))))));
alter policy "Users can create own student progress insights" on public."student_progress_insights" with check (((select auth.uid()) = user_id));
alter policy "Users can delete own student progress insights" on public."student_progress_insights" using (((select auth.uid()) = user_id));
alter policy "Users can update own student progress insights" on public."student_progress_insights" using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Users can view own student progress insights" on public."student_progress_insights" using (((select auth.uid()) = user_id));
alter policy "Tutors can create connected student progress reviews" on public."student_progress_reviews" with check ((is_superadmin() OR (((select auth.uid()) = tutor_id) AND (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.student_id = student_progress_reviews.student_id) AND (ts.tutor_id = (select auth.uid())) AND (ts.status = 'active'::text)))))));
alter policy "Tutors can delete own student progress reviews" on public."student_progress_reviews" using ((is_superadmin() OR ((select auth.uid()) = tutor_id)));
alter policy "Tutors can update own student progress reviews" on public."student_progress_reviews" using ((is_superadmin() OR ((select auth.uid()) = tutor_id))) with check ((is_superadmin() OR ((select auth.uid()) = tutor_id)));
alter policy "Tutors can view connected student progress reviews" on public."student_progress_reviews" using ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.student_id = student_progress_reviews.student_id) AND (ts.tutor_id = (select auth.uid())) AND (ts.status = 'active'::text))))));
alter policy "Students can view own student vocabulary items" on public."student_vocabulary_items" using ((student_id = (select auth.uid())));
alter policy "Tutors and superadmins can view student vocabulary items" on public."student_vocabulary_items" using ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students
  WHERE ((tutor_students.student_id = student_vocabulary_items.student_id) AND (tutor_students.tutor_id = (select auth.uid())) AND (tutor_students.status = 'active'::text))))));
alter policy "Students can view own lesson balance transactions" on public."tutor_student_balance_transactions" using (((select auth.uid()) = student_id));
alter policy "Tutors can create own lesson balance transactions" on public."tutor_student_balance_transactions" with check ((((select auth.uid()) = tutor_id) AND (created_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = tutor_student_balance_transactions.tutor_id) AND (ts.student_id = tutor_student_balance_transactions.student_id) AND (ts.status = 'active'::text))))));
alter policy "Tutors can view own lesson balance transactions" on public."tutor_student_balance_transactions" using (((select auth.uid()) = tutor_id));
alter policy "Participants can view classroom recordings" on public."tutor_student_classroom_recordings" using ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_recordings.classroom_id) AND ((connection.tutor_id = (select auth.uid())) OR (connection.student_id = (select auth.uid())))))));
alter policy "Tutors can manage classroom recordings" on public."tutor_student_classroom_recordings" using ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_recordings.classroom_id) AND (connection.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_recordings.classroom_id) AND (connection.tutor_id = (select auth.uid()))))));
alter policy "Participants can view classroom session summaries" on public."tutor_student_classroom_session_summaries" using ((EXISTS ( SELECT 1
   FROM tutor_students connection
  WHERE ((connection.id = tutor_student_classroom_session_summaries.connection_id) AND ((connection.tutor_id = (select auth.uid())) OR (connection.student_id = (select auth.uid())))))));
alter policy "Tutors can manage classroom session summaries" on public."tutor_student_classroom_session_summaries" using ((EXISTS ( SELECT 1
   FROM tutor_students connection
  WHERE ((connection.id = tutor_student_classroom_session_summaries.connection_id) AND (connection.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM tutor_students connection
  WHERE ((connection.id = tutor_student_classroom_session_summaries.connection_id) AND (connection.tutor_id = (select auth.uid()))))));
alter policy "Participants can view classroom transcript segments" on public."tutor_student_classroom_transcript_segments" using ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_transcript_segments.classroom_id) AND ((connection.tutor_id = (select auth.uid())) OR (connection.student_id = (select auth.uid())))))));
alter policy "Tutors can manage classroom transcript segments" on public."tutor_student_classroom_transcript_segments" using ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_transcript_segments.classroom_id) AND (connection.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_transcript_segments.classroom_id) AND (connection.tutor_id = (select auth.uid()))))));
alter policy "Participants can view classroom transcripts" on public."tutor_student_classroom_transcripts" using ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_transcripts.classroom_id) AND ((connection.tutor_id = (select auth.uid())) OR (connection.student_id = (select auth.uid())))))));
alter policy "Tutors can manage classroom transcripts" on public."tutor_student_classroom_transcripts" using ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_transcripts.classroom_id) AND (connection.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM (tutor_student_classrooms classroom
     JOIN tutor_students connection ON ((connection.id = classroom.connection_id)))
  WHERE ((classroom.id = tutor_student_classroom_transcripts.classroom_id) AND (connection.tutor_id = (select auth.uid()))))));
alter policy "Participants can view tutor student classrooms" on public."tutor_student_classrooms" using ((EXISTS ( SELECT 1
   FROM tutor_students connection
  WHERE ((connection.id = tutor_student_classrooms.connection_id) AND ((connection.tutor_id = (select auth.uid())) OR (connection.student_id = (select auth.uid())))))));
alter policy "Tutors can manage tutor student classrooms" on public."tutor_student_classrooms" using ((EXISTS ( SELECT 1
   FROM tutor_students connection
  WHERE ((connection.id = tutor_student_classrooms.connection_id) AND (connection.tutor_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM tutor_students connection
  WHERE ((connection.id = tutor_student_classrooms.connection_id) AND (connection.tutor_id = (select auth.uid()))))));
alter policy "Tutors can manage own lesson library progress" on public."tutor_student_lesson_library" using (((select auth.uid()) = tutor_id)) with check ((((select auth.uid()) = tutor_id) AND (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = tutor_student_lesson_library.student_id) AND (ts.status = 'active'::text))))));
alter policy "Tutors can view own lesson library progress" on public."tutor_student_lesson_library" using (((select auth.uid()) = tutor_id));
alter policy "Tutors can manage own covered lesson topics" on public."tutor_student_lesson_topics" using (((select auth.uid()) = tutor_id)) with check (((select auth.uid()) = tutor_id));
alter policy "Tutors can view own covered lesson topics" on public."tutor_student_lesson_topics" using (((select auth.uid()) = tutor_id));
alter policy "Students can view own lessons" on public."tutor_student_lessons" using (((select auth.uid()) = student_id));
alter policy "Tutors can create own lessons" on public."tutor_student_lessons" with check ((((select auth.uid()) = tutor_id) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = tutor_student_lessons.student_id) AND (ts.status = 'active'::text)))))));
alter policy "Tutors can delete own lessons" on public."tutor_student_lessons" using (((select auth.uid()) = tutor_id));
alter policy "Tutors can update own lessons" on public."tutor_student_lessons" using (((select auth.uid()) = tutor_id)) with check ((((select auth.uid()) = tutor_id) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = tutor_student_lessons.student_id) AND (ts.status = 'active'::text)))))));
alter policy "Tutors can view own lessons" on public."tutor_student_lessons" using (((select auth.uid()) = tutor_id));
alter policy "Tutors can create monthly plans for connected students" on public."tutor_student_monthly_plans" with check ((is_superadmin() OR ((tutor_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.id = tutor_student_monthly_plans.connection_id) AND (ts.tutor_id = (select auth.uid())) AND (ts.student_id = tutor_student_monthly_plans.student_id) AND (ts.status = 'active'::text)))))));
alter policy "Tutors can delete monthly plans for connected students" on public."tutor_student_monthly_plans" using ((is_superadmin() OR (tutor_id = (select auth.uid()))));
alter policy "Tutors can update monthly plans for connected students" on public."tutor_student_monthly_plans" using ((is_superadmin() OR (tutor_id = (select auth.uid())))) with check ((is_superadmin() OR (tutor_id = (select auth.uid()))));
alter policy "Tutors can view monthly plans for connected students" on public."tutor_student_monthly_plans" using ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.id = tutor_student_monthly_plans.connection_id) AND (ts.tutor_id = (select auth.uid())) AND (ts.status = 'active'::text))))));
alter policy "Students can view published own monthly reports" on public."tutor_student_monthly_reports" using ((((select auth.uid()) = student_id) AND (status = 'published'::text)));
alter policy "Tutors can create connected student monthly reports" on public."tutor_student_monthly_reports" with check ((is_superadmin() OR (((select auth.uid()) = tutor_id) AND ((generated_by IS NULL) OR (generated_by = (select auth.uid()))) AND (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.student_id = tutor_student_monthly_reports.student_id) AND (ts.tutor_id = (select auth.uid())) AND (ts.status = 'active'::text)))))));
alter policy "Tutors can delete own student monthly reports" on public."tutor_student_monthly_reports" using ((is_superadmin() OR ((select auth.uid()) = tutor_id)));
alter policy "Tutors can update own student monthly reports" on public."tutor_student_monthly_reports" using ((is_superadmin() OR ((select auth.uid()) = tutor_id))) with check ((is_superadmin() OR ((select auth.uid()) = tutor_id)));
alter policy "Tutors can view connected student monthly reports" on public."tutor_student_monthly_reports" using ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.student_id = tutor_student_monthly_reports.student_id) AND (ts.tutor_id = (select auth.uid())) AND (ts.status = 'active'::text))))));
alter policy "Tutors can create own student progress overrides" on public."tutor_student_progress_overrides" with check ((((select auth.uid()) = tutor_id) AND (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = tutor_student_progress_overrides.student_id) AND (ts.status = 'active'::text))))));
alter policy "Tutors can delete own student progress overrides" on public."tutor_student_progress_overrides" using (((select auth.uid()) = tutor_id));
alter policy "Tutors can update own student progress overrides" on public."tutor_student_progress_overrides" using (((select auth.uid()) = tutor_id)) with check ((((select auth.uid()) = tutor_id) AND (EXISTS ( SELECT 1
   FROM tutor_students ts
  WHERE ((ts.tutor_id = (select auth.uid())) AND (ts.student_id = tutor_student_progress_overrides.student_id) AND (ts.status = 'active'::text))))));
alter policy "Tutors can view own student progress overrides" on public."tutor_student_progress_overrides" using (((select auth.uid()) = tutor_id));
alter policy "Students can activate connections" on public."tutor_students" using ((((select auth.uid()) = student_id) AND (status = 'pending'::text)));
alter policy "Students can delete connections" on public."tutor_students" using (((select auth.uid()) = student_id));
alter policy "Students can view own connections" on public."tutor_students" using (((select auth.uid()) = student_id));
alter policy "Tutors can create connections" on public."tutor_students" with check (((select auth.uid()) = tutor_id));
alter policy "Tutors can delete connections" on public."tutor_students" using (((select auth.uid()) = tutor_id));
alter policy "Tutors can update own connections" on public."tutor_students" using (((select auth.uid()) = tutor_id)) with check (((select auth.uid()) = tutor_id));
alter policy "Tutors can view own connections" on public."tutor_students" using (((select auth.uid()) = tutor_id));
alter policy "Users can manage own word banks" on public."word_banks" using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Students can read own word mastery" on public."word_mastery" using (((select auth.uid()) = student_id));
