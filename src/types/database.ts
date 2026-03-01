import type { Role } from "./roles";

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
          plan?: string;
          ai_calls_this_month?: number;
          ai_calls_reset_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      word_mastery: {
        Row: {
          id: string;
          student_id: string;
          term: string;
          definition: string;
          mastery_level: number;
          correct_count: number;
          incorrect_count: number;
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
      [_ in never]: never;
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
export type WordBank = Database["public"]["Tables"]["word_banks"]["Row"];
export type WordMastery = Database["public"]["Tables"]["word_mastery"]["Row"];
