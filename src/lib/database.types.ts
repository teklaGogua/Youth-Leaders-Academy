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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: AppRole; full_name: string | null; created_at: string; updated_at: string };
        Insert: { id: string; role?: AppRole; full_name?: string | null };
        Update: { full_name?: string | null; updated_at?: string };
        Relationships: [];
      };
      participants: {
        Row: TimestampFields & {
          id: string; user_id: string; first_name: string | null; last_name: string | null;
          age: number | null; biography: string | null; school: string | null; grade: string | null;
          teacher_name: string | null; parent_contact_name: string | null;
          parent_contact_phone: string | null; parent_contact_email: string | null;
        };
        Insert: {
          id?: string; user_id: string; first_name?: string | null; last_name?: string | null;
          age?: number | null; biography?: string | null; school?: string | null; grade?: string | null;
          teacher_name?: string | null; parent_contact_name?: string | null;
          parent_contact_phone?: string | null; parent_contact_email?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['participants']['Insert'], 'user_id' | 'id'>>;
        Relationships: [];
      };
      competitions: {
        Row: TimestampFields & {
          id: string; slug: string; title: string; description: string | null;
          registration_start: string | null; registration_end: string | null; event_date: string | null;
          fee: number | null; status: CompetitionStatus;
        };
        Insert: {
          id?: string; slug: string; title: string; description?: string | null;
          registration_start?: string | null; registration_end?: string | null; event_date?: string | null;
          fee?: number | null; status?: CompetitionStatus;
        };
        Update: Partial<Database['public']['Tables']['competitions']['Insert']>;
        Relationships: [];
      };
      applications: {
        Row: TimestampFields & { id: string; participant_id: string; competition_id: string; status: ApplicationStatus };
        Insert: { id?: string; participant_id: string; competition_id: string; status?: ApplicationStatus };
        Update: { status?: ApplicationStatus; updated_at?: string };
        Relationships: [];
      };
      faq_entries: {
        Row: TimestampFields & { id: string; question: string; answer: string; category: string | null; is_published: boolean };
        Insert: { id?: string; question: string; answer: string; category?: string | null; is_published?: boolean };
        Update: Partial<Database['public']['Tables']['faq_entries']['Insert']>;
        Relationships: [];
      };
      audit_logs: {
        Row: { id: string; actor_id: string | null; action: string; entity_table: string; entity_id: string | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: { is_administrator: { Args: Record<PropertyKey, never>; Returns: boolean } };
    Enums: {
      app_role: AppRole;
      competition_status: CompetitionStatus;
      application_status: ApplicationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
