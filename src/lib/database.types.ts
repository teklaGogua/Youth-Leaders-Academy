export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'participant' | 'administrator';
export type CompetitionStatus = 'draft' | 'published' | 'archived';
export type ApplicationStatus = 'registered' | 'pending' | 'approved' | 'rejected';

type TimestampFields = {
  created_at: string;
  updated_at: string;
};

export type ParticipantRegistration = TimestampFields & {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  biography: string | null;
  school: string | null;
  grade: string | null;
  teacher_name: string | null;
  guardian_full_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_verified_at: string | null;
  guardian_verified_email: string | null;
  step_1_completed_at: string | null;
  step_2_completed_at: string | null;
  step_3_completed_at: string | null;
  step_4_completed_at: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  privacy_version: string | null;
  privacy_accepted_at: string | null;
  parental_consent_at: string | null;
  parental_consent_rejected_at: string | null;
  parental_consent_terms_version: string | null;
  parental_consent_privacy_version: string | null;
  parental_consent_version: string | null;
  completed_at: string | null;
};

export type LegalDocument = {
  id: string;
  document_type: 'terms' | 'privacy' | 'guardian_consent';
  version: string;
  title: string;
  content: string;
  is_current: boolean;
  approved_at: string | null;
  created_at: string;
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
      participant_registrations: {
        Row: ParticipantRegistration;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      legal_documents: {
        Row: LegalDocument;
        Insert: never;
        Update: never;
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
      save_participant_registration_step: {
        Args: { p_step: number; p_payload: Json };
        Returns: Json;
      };
      complete_participant_registration: { Args: Record<PropertyKey, never>; Returns: boolean };
      validate_guardian_decision_token: { Args: { p_token_hash: string }; Returns: boolean };
      confirm_guardian_decision: {
        Args: { p_token_hash: string; p_agree: boolean };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRole;
      competition_status: CompetitionStatus;
      application_status: ApplicationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
