export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'participant' | 'administrator';
export type CompetitionStatus = 'draft' | 'published' | 'archived';
export type ApplicationStatus = 'registered' | 'pending' | 'approved' | 'rejected';

type TimestampFields = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: AppRole;
          full_name: string | null;
          created_at: string;
          updated_at: string;
          registration_completed_at: string | null;
        };
        Insert: never;
        Update: { full_name?: string | null };
        Relationships: [];
      };
      participants: {
        Row: TimestampFields & {
          id: string;
          user_id: string;
          first_name: string | null;
          last_name: string | null;
          age: number | null;
          biography: string | null;
          school: string | null;
          grade: string | null;
          teacher_name: string | null;
          parent_contact_name: string | null;
          parent_contact_phone: string | null;
          parent_contact_email: string | null;
          parent_contact_email_verified_at: string | null;
        };
        Insert: {
          user_id: string;
          first_name?: string | null;
          last_name?: string | null;
          age?: number | null;
          biography?: string | null;
          school?: string | null;
          grade?: string | null;
          teacher_name?: string | null;
          parent_contact_name?: string | null;
          parent_contact_phone?: string | null;
          parent_contact_email?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['participants']['Insert'], 'user_id' | 'id'>
        >;
        Relationships: [];
      };
      competitions: {
        Row: TimestampFields & {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          registration_start: string | null;
          registration_end: string | null;
          event_date: string | null;
          fee: number | null;
          status: CompetitionStatus;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          registration_start?: string | null;
          registration_end?: string | null;
          event_date?: string | null;
          fee?: number | null;
          status?: CompetitionStatus;
        };
        Update: Partial<Database['public']['Tables']['competitions']['Insert']>;
        Relationships: [];
      };
      applications: {
        Row: TimestampFields & {
          id: string;
          participant_id: string;
          competition_id: string;
          status: ApplicationStatus;
        };
        Insert: {
          id?: string;
          participant_id: string;
          competition_id: string;
          status?: ApplicationStatus;
        };
        Update: { status?: ApplicationStatus; updated_at?: string };
        Relationships: [];
      };
      faq_entries: {
        Row: TimestampFields & {
          id: string;
          question: string;
          answer: string;
          category: string | null;
          is_published: boolean;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          category?: string | null;
          is_published?: boolean;
        };
        Update: Partial<Database['public']['Tables']['faq_entries']['Insert']>;
        Relationships: [];
      };
      registration_documents: {
        Row: { slug: 'terms' | 'privacy'; version: string; title: string; content: string; is_published: boolean; updated_at: string };
        Insert: { slug: 'terms' | 'privacy'; version: string; title: string; content: string; is_published?: boolean };
        Update: Partial<Database['public']['Tables']['registration_documents']['Insert']>;
        Relationships: [];
      };
      registration_acceptances: {
        Row: { user_id: string; terms_version: string; privacy_version: string; accepted_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_table: string;
          entity_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_administrator: { Args: Record<PropertyKey, never>; Returns: boolean };
      save_participant_profile: { Args: { p_participant: Json; p_complete?: boolean }; Returns: undefined };
      complete_participant_registration: { Args: { p_terms_version: string; p_privacy_version: string }; Returns: string };
      create_parent_email_verification: { Args: { p_user_id: string; p_email: string }; Returns: string };
      verify_parent_email_token: { Args: { p_token: string }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      competition_status: CompetitionStatus;
      application_status: ApplicationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
