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
          app_language: string;
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
          app_language?: string;
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
          app_language?: string;
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
      student_grammar_topic_mastery: {
        Row: {
          id: string;
          student_id: string;
          topic_key: string;
          source: string;
          tutor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          topic_key: string;
          source: string;
          tutor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          topic_key?: string;
          source?: string;
          tutor_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_grammar_topic_mastery_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_grammar_topic_mastery_tutor_id_fkey";
            columns: ["tutor_id"];
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
          student_id: string | null;
          title: string | null;
          lesson_date: string;
          start_time: string | null;
          end_time: string | null;
          notes: string | null;
          status: "planned" | "completed" | "cancelled";
          price_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          student_id?: string | null;
          title?: string | null;
          lesson_date: string;
          start_time?: string | null;
          end_time?: string | null;
          notes?: string | null;
          status?: "planned" | "completed" | "cancelled";
          price_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tutor_id?: string;
          student_id?: string | null;
          title?: string | null;
          lesson_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          notes?: string | null;
          status?: "planned" | "completed" | "cancelled";
          price_cents?: number;
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
      tutor_student_balance_transactions: {
        Row: {
          id: string;
          tutor_id: string;
          student_id: string;
          created_by: string;
          amount_cents: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          student_id: string;
          created_by: string;
          amount_cents: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          tutor_id?: string;
          student_id?: string;
          created_by?: string;
          amount_cents?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_student_balance_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_student_balance_transactions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_student_balance_transactions_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      google_calendar_connections: {
        Row: {
          user_id: string;
          google_email: string | null;
          calendar_id: string;
          access_token: string;
          refresh_token: string;
          scope: string | null;
          access_token_expires_at: string | null;
          last_synced_at: string | null;
          last_sync_error: string | null;
          connected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          google_email?: string | null;
          calendar_id?: string;
          access_token: string;
          refresh_token: string;
          scope?: string | null;
          access_token_expires_at?: string | null;
          last_synced_at?: string | null;
          last_sync_error?: string | null;
          connected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          google_email?: string | null;
          calendar_id?: string;
          access_token?: string;
          refresh_token?: string;
          scope?: string | null;
          access_token_expires_at?: string | null;
          last_synced_at?: string | null;
          last_sync_error?: string | null;
          connected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_google_calendar_events: {
        Row: {
          lesson_id: string;
          user_id: string;
          google_calendar_id: string;
          google_event_id: string;
          synced_at: string;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lesson_id: string;
          user_id: string;
          google_calendar_id?: string;
          google_event_id: string;
          synced_at?: string;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lesson_id?: string;
          user_id?: string;
          google_calendar_id?: string;
          google_event_id?: string;
          synced_at?: string;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_google_calendar_events_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: true;
            referencedRelation: "tutor_student_lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_google_calendar_events_user_id_fkey";
            columns: ["user_id"];
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
          library_item_id: string | null;
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
          library_item_id?: string | null;
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
          library_item_id?: string | null;
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
            foreignKeyName: "passive_vocabulary_evidence_library_item_id_fkey";
            columns: ["library_item_id"];
            isOneToOne: false;
            referencedRelation: "passive_vocabulary_library";
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
      passive_vocabulary_library: {
        Row: {
          id: string;
          canonical_term: string;
          normalized_term: string;
          item_type: "word" | "phrase";
          cefr_level: string | null;
          part_of_speech: string | null;
          attributes: Json;
          enrichment_status: "pending" | "completed" | "failed";
          enrichment_error: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          canonical_term: string;
          normalized_term: string;
          item_type?: "word" | "phrase";
          cefr_level?: string | null;
          part_of_speech?: string | null;
          attributes?: Json;
          enrichment_status?: "pending" | "completed" | "failed";
          enrichment_error?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          canonical_term?: string;
          normalized_term?: string;
          item_type?: "word" | "phrase";
          cefr_level?: string | null;
          part_of_speech?: string | null;
          attributes?: Json;
          enrichment_status?: "pending" | "completed" | "failed";
          enrichment_error?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "passive_vocabulary_library_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passive_vocabulary_library_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      passive_vocabulary_library_forms: {
        Row: {
          id: string;
          library_item_id: string;
          form_term: string;
          normalized_form: string;
          item_type: "word" | "phrase";
          is_canonical: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          library_item_id: string;
          form_term: string;
          normalized_form: string;
          item_type?: "word" | "phrase";
          is_canonical?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          library_item_id?: string;
          form_term?: string;
          normalized_form?: string;
          item_type?: "word" | "phrase";
          is_canonical?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "passive_vocabulary_library_forms_library_item_id_fkey";
            columns: ["library_item_id"];
            isOneToOne: false;
            referencedRelation: "passive_vocabulary_library";
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
          time_spent_seconds: number;
          completed_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          student_id: string;
          answers: Record<string, unknown>;
          score?: number | null;
          max_score?: number | null;
          time_spent_seconds?: number;
          completed_at?: string;
        };
        Update: {
          answers?: Record<string, unknown>;
          score?: number | null;
          max_score?: number | null;
          time_spent_seconds?: number;
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
          lesson_price_cents: number;
          plan_title: string | null;
          goal_summary: string | null;
          objectives: Json;
          grammar_topic_keys: Json;
          report_language: string;
          monthly_quiz_target: number | null;
          monthly_sentence_translation_target: number | null;
          monthly_gap_fill_target: number | null;
          monthly_completed_lessons_target: number | null;
          monthly_new_mastery_words_target: number | null;
          monthly_average_score_target: number | null;
          created_at: string;
          connected_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          student_id?: string;
          connect_code?: string | null;
          status?: string;
          lesson_price_cents?: number;
          plan_title?: string | null;
          goal_summary?: string | null;
          objectives?: Json;
          grammar_topic_keys?: Json;
          report_language?: string;
          monthly_quiz_target?: number | null;
          monthly_sentence_translation_target?: number | null;
          monthly_gap_fill_target?: number | null;
          monthly_completed_lessons_target?: number | null;
          monthly_new_mastery_words_target?: number | null;
          monthly_average_score_target?: number | null;
          created_at?: string;
          connected_at?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: string;
          student_id?: string;
          connected_at?: string | null;
          connect_code?: string | null;
          lesson_price_cents?: number;
          plan_title?: string | null;
          goal_summary?: string | null;
          objectives?: Json;
          grammar_topic_keys?: Json;
          report_language?: string;
          monthly_quiz_target?: number | null;
          monthly_sentence_translation_target?: number | null;
          monthly_gap_fill_target?: number | null;
          monthly_completed_lessons_target?: number | null;
          monthly_new_mastery_words_target?: number | null;
          monthly_average_score_target?: number | null;
          updated_at?: string;
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
      tutor_student_monthly_reports: {
        Row: {
          id: string;
          tutor_id: string;
          student_id: string;
          generated_by: string | null;
          report_month: string;
          period_start: string;
          period_end: string;
          generation_source: string;
          status: string;
          title: string;
          ai_draft: string | null;
          published_content: string | null;
          tutor_addendum: string | null;
          review_rating: number | null;
          plan_snapshot: Json;
          metrics_snapshot: Json;
          generation_error: string | null;
          created_at: string;
          updated_at: string;
          generated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          student_id: string;
          generated_by?: string | null;
          report_month: string;
          period_start: string;
          period_end: string;
          generation_source: string;
          status: string;
          title: string;
          ai_draft?: string | null;
          published_content?: string | null;
          tutor_addendum?: string | null;
          review_rating?: number | null;
          plan_snapshot?: Json;
          metrics_snapshot?: Json;
          generation_error?: string | null;
          created_at?: string;
          updated_at?: string;
          generated_at?: string;
          published_at?: string | null;
        };
        Update: {
          tutor_id?: string;
          student_id?: string;
          generated_by?: string | null;
          report_month?: string;
          period_start?: string;
          period_end?: string;
          generation_source?: string;
          status?: string;
          title?: string;
          ai_draft?: string | null;
          published_content?: string | null;
          tutor_addendum?: string | null;
          review_rating?: number | null;
          plan_snapshot?: Json;
          metrics_snapshot?: Json;
          generation_error?: string | null;
          created_at?: string;
          updated_at?: string;
          generated_at?: string;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_student_monthly_reports_generated_by_fkey";
            columns: ["generated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_student_monthly_reports_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_student_monthly_reports_tutor_id_fkey";
            columns: ["tutor_id"];
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
export type TutorStudentBalanceTransaction =
  Database["public"]["Tables"]["tutor_student_balance_transactions"]["Row"];
export type TutorStudentMonthlyReport =
  Database["public"]["Tables"]["tutor_student_monthly_reports"]["Row"];
export type TutorStudentProgressOverride =
  Database["public"]["Tables"]["tutor_student_progress_overrides"]["Row"];
export type PassiveVocabularyEvidence =
  Database["public"]["Tables"]["passive_vocabulary_evidence"]["Row"];
export type WordMastery = Database["public"]["Tables"]["word_mastery"]["Row"];
