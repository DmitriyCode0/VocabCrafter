-- Add meet_url column to tutor_student_lessons for Google Meet integration
ALTER TABLE tutor_student_lessons ADD COLUMN IF NOT EXISTS meet_url TEXT;

