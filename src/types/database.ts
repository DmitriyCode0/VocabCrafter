import type { Role } from "./roles";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: Role;
          onboarding_completed: boolean;
          cefr_level: string;
          preferred_language: string;
          source_language: string;
          ai_voice: string;
          plan: string;
          ai_calls_this_month: number;
          ai_calls_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Role;
          onboarding_completed?: boolean;
          cefr_level?: string;
          preferred_language?: string;
          source_language?: string;
          ai_voice?: string;
          plan?: string;
          ai_calls_this_month?: number;
          ai_calls_reset_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Role;
          onboarding_completed?: boolean;
          cefr_level?: string;
          preferred_language?: string;
          source_language?: string;
          ai_voice?: string;
          plan?: string;
          ai_calls_this_month?: number;
          ai_calls_reset_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_limits: {
        Row: {
          key: string;
          price: number;
          ai_calls_per_month: number;
          reports_per_month: number | null;
          quizzes_per_month: number | null;
          attempts_per_month: number | null;
          word_banks: number | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          price: number;
          ai_calls_per_month: number;
          reports_per_month?: number | null;
          quizzes_per_month?: number | null;
          attempts_per_month?: number | null;
          word_banks?: number | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          price?: number;
          ai_calls_per_month?: number;
          reports_per_month?: number | null;
          quizzes_per_month?: number | null;
          attempts_per_month?: number | null;
          word_banks?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_progress_insights: {
        Row: {
          id: string;
          user_id: string;
          insights: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          insights?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          insights?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_progress_insights_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_progress_reviews: {
        Row: {
          id: string;
          student_id: string;
          tutor_id: string;
          content: string;
          rating: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          tutor_id: string;
          content: string;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          tutor_id?: string;
          content?: string;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_progress_reviews_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_progress_reviews_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_student_lessons: {
        Row: {
          id: string;
          tutor_id: string;
          student_id: string;
          title: string;
          lesson_date: string;
          start_time: string | null;
          end_time: string | null;
          notes: string | null;
          status: "planned" | "completed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          student_id: string;
          title: string;
          lesson_date: string;
          start_time?: string | null;
          end_time?: string | null;
          notes?: string | null;
          status?: "planned" | "completed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tutor_id?: string;
          student_id?: string;
          title?: string;
          lesson_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          notes?: string | null;
          status?: "planned" | "completed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_student_lessons_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_student_lessons_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      passive_vocabulary_evidence: {
        Row: {
          id: string;
          student_id: string;
          imported_by: string | null;
          term: string;
          normalized_term: string;
          definition: string | null;
          item_type: "word" | "phrase";
          source_type: "full_text" | "manual_list" | "curated_list";
          source_label: string | null;
          confidence: number;
          import_count: number;
          last_imported_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          imported_by?: string | null;
          term: string;
          normalized_term: string;
          definition?: string | null;
          item_type?: "word" | "phrase";
          source_type?: "full_text" | "manual_list" | "curated_list";
          source_label?: string | null;
          confidence?: number;
          import_count?: number;
          last_imported_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          imported_by?: string | null;
          term?: string;
          normalized_term?: string;
          definition?: string | null;
          item_type?: "word" | "phrase";
          source_type?: "full_text" | "manual_list" | "curated_list";
          source_label?: string | null;
          confidence?: number;
          import_count?: number;
          last_imported_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "passive_vocabulary_evidence_imported_by_fkey";
            columns: ["imported_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passive_vocabulary_evidence_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          id: string;
          tutor_id: string;
          name: string;
          description: string | null;
          join_code: string;
          cefr_level: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          name: string;
          description?: string | null;
          join_code: string;
          cefr_level?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          tutor_id?: string;
          name?: string;
          description?: string | null;
          join_code?: string;
          cefr_level?: string;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "classes_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_members: {
        Row: {
          id: string;
          class_id: string;
          student_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          student_id: string;
          joined_at?: string;
        };
        Update: {
          class_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_members_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quizzes: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          type: string;
          cefr_level: string;
          vocabulary_terms: Record<string, unknown>[];
          generated_content: Record<string, unknown>;
          config: Record<string, unknown> | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          type: string;
          cefr_level: string;
          vocabulary_terms: Record<string, unknown>[];
          generated_content: Record<string, unknown>;
          config?: Record<string, unknown> | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          type?: string;
          cefr_level?: string;
          vocabulary_terms?: Record<string, unknown>[];
          generated_content?: Record<string, unknown>;
          config?: Record<string, unknown> | null;
          is_public?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          id: string;
          quiz_id: string;
          student_id: string;
          answers: Record<string, unknown>;
          score: number | null;
          max_score: number | null;
          completed_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          student_id: string;
          answers: Record<string, unknown>;
          score?: number | null;
          max_score?: number | null;
          completed_at?: string;
        };
        Update: {
          answers?: Record<string, unknown>;
          score?: number | null;
          max_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assignments: {
        Row: {
          id: string;
          class_id: string;
          tutor_id: string;
          quiz_id: string;
          title: string;
          instructions: string | null;
          due_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          tutor_id: string;
          quiz_id: string;
          title: string;
          instructions?: string | null;
          due_date?: string | null;
          created_at?: string;
        };
        Update: {
          class_id?: string;
          quiz_id?: string;
          title?: string;
          instructions?: string | null;
          due_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          id: string;
          attempt_id: string;
          tutor_id: string;
          content: string;
          rating: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          tutor_id: string;
          content: string;
          rating?: number | null;
          created_at?: string;
        };
        Update: {
          content?: string;
          rating?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "quiz_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_events: {
        Row: {
          id: string;
          user_id: string;
          feature: string;
          request_type: string;
          provider: string;
          model: string;
          prompt_tokens: number;
          response_tokens: number;
          audio_output_tokens: number;
          total_tokens: number;
          is_estimated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature: string;
          request_type: string;
          provider?: string;
          model: string;
          prompt_tokens?: number;
          response_tokens?: number;
          audio_output_tokens?: number;
          total_tokens?: number;
          is_estimated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          feature?: string;
          request_type?: string;
          provider?: string;
          model?: string;
          prompt_tokens?: number;
          response_tokens?: number;
          audio_output_tokens?: number;
          total_tokens?: number;
          is_estimated?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      grammar_topic_prompt_overrides: {
        Row: {
          topic_key: string;
          display_name: string | null;
          learning_language: string | null;
          cefr_level: string | null;
          rule_text: string | null;
          guidance_text: string | null;
          evaluation_instructions: string | null;
          is_custom: boolean;
          is_archived: boolean;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          topic_key: string;
          display_name?: string | null;
          learning_language?: string | null;
          cefr_level?: string | null;
          rule_text?: string | null;
          guidance_text?: string | null;
          evaluation_instructions?: string | null;
          is_custom?: boolean;
          is_archived?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          topic_key?: string;
          display_name?: string | null;
          learning_language?: string | null;
          cefr_level?: string | null;
          rule_text?: string | null;
          guidance_text?: string | null;
          evaluation_instructions?: string | null;
          is_custom?: boolean;
          is_archived?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grammar_topic_prompt_overrides_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      word_banks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          terms: Record<string, unknown>[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          terms: Record<string, unknown>[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          terms?: Record<string, unknown>[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "word_banks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_students: {
        Row: {
          id: string;
          tutor_id: string;
          student_id: string;
          connect_code: string | null;
          status: string;
          created_at: string;
          connected_at: string | null;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          student_id?: string;
          connect_code?: string | null;
          status?: string;
          created_at?: string;
          connected_at?: string | null;
        };
        Update: {
          status?: string;
          student_id?: string;
          connected_at?: string | null;
          connect_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_students_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_student_progress_overrides: {
        Row: {
          id: string;
          tutor_id: string;
          student_id: string;
          axis_overrides: Json;
          insights_override: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          student_id: string;
          axis_overrides?: Json;
          insights_override?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tutor_id?: string;
          student_id?: string;
          axis_overrides?: Json;
          insights_override?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_student_progress_overrides_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_student_progress_overrides_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      word_mastery: {
        Row: {
          id: string;
          student_id: string;
          term: string;
          definition: string;
          mastery_level: number;
          correct_count: number;
          incorrect_count: number;
          translation_correct_count: number;
          streak: number;
          last_practiced: string;
          next_review: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          term: string;
          definition?: string;
          mastery_level?: number;
          correct_count?: number;
          incorrect_count?: number;
          translation_correct_count?: number;
          streak?: number;
          last_practiced?: string;
          next_review?: string;
          created_at?: string;
        };
        Update: {
          student_id?: string;
          term?: string;
          definition?: string;
          mastery_level?: number;
          correct_count?: number;
          incorrect_count?: number;
          translation_correct_count?: number;
          streak?: number;
          last_practiced?: string;
          next_review?: string;
        };
        Relationships: [
          {
            foreignKeyName: "word_mastery_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      log_ai_usage_event: {
        Args: {
          p_user_id: string;
          p_feature: string;
          p_request_type: string;
          p_provider: string;
          p_model: string;
          p_prompt_tokens: number;
          p_response_tokens: number;
          p_audio_output_tokens: number;
          p_total_tokens: number;
          p_is_estimated: boolean;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Class = Database["public"]["Tables"]["classes"]["Row"];
export type ClassMember = Database["public"]["Tables"]["class_members"]["Row"];
export type Quiz = Database["public"]["Tables"]["quizzes"]["Row"];
export type QuizAttempt = Database["public"]["Tables"]["quiz_attempts"]["Row"];
export type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
export type Feedback = Database["public"]["Tables"]["feedback"]["Row"];
export type GrammarTopicPromptOverride =
  Database["public"]["Tables"]["grammar_topic_prompt_overrides"]["Row"];
export type WordBank = Database["public"]["Tables"]["word_banks"]["Row"];
export type TutorStudent =
  Database["public"]["Tables"]["tutor_students"]["Row"];
export type StudentProgressReview =
  Database["public"]["Tables"]["student_progress_reviews"]["Row"];
export type TutorStudentLesson =
  Database["public"]["Tables"]["tutor_student_lessons"]["Row"];
export type TutorStudentProgressOverride =
  Database["public"]["Tables"]["tutor_student_progress_overrides"]["Row"];
export type PassiveVocabularyEvidence =
  Database["public"]["Tables"]["passive_vocabulary_evidence"]["Row"];
export type WordMastery = Database["public"]["Tables"]["word_mastery"]["Row"];
