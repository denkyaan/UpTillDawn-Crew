export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_role_modes: {
        Row: {
          active_role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      break_sessions: {
        Row: {
          created_at: string
          end_time: string | null
          ended_at: string | null
          id: string
          start_time: string
          started_at: string
          user_id: string
          work_session_id: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          ended_at?: string | null
          id?: string
          start_time: string
          started_at?: string
          user_id: string
          work_session_id: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          ended_at?: string | null
          id?: string
          start_time?: string
          started_at?: string
          user_id?: string
          work_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_sessions_work_session_id_fkey"
            columns: ["work_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_acknowledgements: {
        Row: {
          acknowledged_at: string
          briefing_id: string
          id: string
          user_id: string
          version: number
        }
        Insert: {
          acknowledged_at?: string
          briefing_id: string
          id?: string
          user_id: string
          version: number
        }
        Update: {
          acknowledged_at?: string
          briefing_id?: string
          id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "briefing_acknowledgements_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefing_acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          required: boolean
          title: string
          updated_at: string
          version: number
          workplace_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          required?: boolean
          title: string
          updated_at?: string
          version?: number
          workplace_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          required?: boolean
          title?: string
          updated_at?: string
          version?: number
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefings_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          kind: string
          name: string | null
          workplace_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind: string
          name?: string | null
          workplace_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          name?: string | null
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          channel_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          accuracy_m: number | null
          approved_at: string | null
          approved_by: string | null
          contact_confirmed: boolean | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          distance_m: number | null
          early_reason: string | null
          effective_start_at: string | null
          event_id: string
          gps_status: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          remote: boolean
          requested_at: string
          requested_role: string | null
          reviewer_kind: string | null
          selfie_path: string | null
          selfie_url: string | null
          shift_id: string | null
          status: string
          type: string
          user_id: string
          work_session_id: string | null
          workplace_id: string
        }
        Insert: {
          accuracy_m?: number | null
          approved_at?: string | null
          approved_by?: string | null
          contact_confirmed?: boolean | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          distance_m?: number | null
          early_reason?: string | null
          effective_start_at?: string | null
          event_id: string
          gps_status?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          remote?: boolean
          requested_at?: string
          requested_role?: string | null
          reviewer_kind?: string | null
          selfie_path?: string | null
          selfie_url?: string | null
          shift_id?: string | null
          status?: string
          type: string
          user_id: string
          work_session_id?: string | null
          workplace_id: string
        }
        Update: {
          accuracy_m?: number | null
          approved_at?: string | null
          approved_by?: string | null
          contact_confirmed?: boolean | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          distance_m?: number | null
          early_reason?: string | null
          effective_start_at?: string | null
          event_id?: string
          gps_status?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          remote?: boolean
          requested_at?: string
          requested_role?: string | null
          reviewer_kind?: string | null
          selfie_path?: string | null
          selfie_url?: string | null
          shift_id?: string | null
          status?: string
          type?: string
          user_id?: string
          work_session_id?: string | null
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_work_session_id_fkey"
            columns: ["work_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      check_outs: {
        Row: {
          contact_confirmed: boolean | null
          decided_at: string | null
          decided_by: string | null
          effective_end_at: string | null
          event_id: string
          id: string
          notes: string | null
          remote: boolean
          requested_at: string
          reviewer_kind: string | null
          shift_id: string | null
          status: string
          user_id: string
          work_session_id: string | null
          workplace_id: string | null
        }
        Insert: {
          contact_confirmed?: boolean | null
          decided_at?: string | null
          decided_by?: string | null
          effective_end_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          remote?: boolean
          requested_at?: string
          reviewer_kind?: string | null
          shift_id?: string | null
          status?: string
          user_id: string
          work_session_id?: string | null
          workplace_id?: string | null
        }
        Update: {
          contact_confirmed?: boolean | null
          decided_at?: string | null
          decided_by?: string | null
          effective_end_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          remote?: boolean
          requested_at?: string
          reviewer_kind?: string | null
          shift_id?: string | null
          status?: string
          user_id?: string
          work_session_id?: string | null
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_outs_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_outs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_outs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_outs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_outs_work_session_id_fkey"
            columns: ["work_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_outs_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          label: string
          photo_path: string | null
          required: boolean
          requires_photo: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label: string
          photo_path?: string | null
          required?: boolean
          requires_photo?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label?: string
          photo_path?: string | null
          required?: boolean
          requires_photo?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "operational_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          note: string | null
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          note?: string | null
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          note?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "configuration_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_availability: {
        Row: {
          available_from: string | null
          available_until: string | null
          breakdown_available: boolean | null
          event_id: string
          notes: string | null
          responded_at: string
          response: string
          setup_available: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          breakdown_available?: boolean | null
          event_id: string
          notes?: string | null
          responded_at?: string
          response: string
          setup_available?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          breakdown_available?: boolean | null
          event_id?: string
          notes?: string | null
          responded_at?: string
          response?: string
          setup_available?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_availability_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          audience: string
          created_at: string
          description: string | null
          event_id: string
          file_name: string
          file_size_bytes: number
          id: string
          is_active: boolean
          kind: string
          mime_type: string
          offline_critical: boolean
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string
          workplace_id: string | null
        }
        Insert: {
          audience: string
          created_at?: string
          description?: string | null
          event_id: string
          file_name: string
          file_size_bytes: number
          id?: string
          is_active?: boolean
          kind: string
          mime_type: string
          offline_critical?: boolean
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by: string
          workplace_id?: string | null
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string | null
          event_id?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          is_active?: boolean
          kind?: string
          mime_type?: string
          offline_critical?: boolean
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      event_emergency_information: {
        Row: {
          assembly_point: string | null
          emergency_number: string
          event_id: string
          first_aid_contact: string | null
          procedure: string | null
          security_contact: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assembly_point?: string | null
          emergency_number?: string
          event_id: string
          first_aid_contact?: string | null
          procedure?: string | null
          security_contact?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assembly_point?: string | null
          emergency_number?: string
          event_id?: string
          first_aid_contact?: string | null
          procedure?: string | null
          security_contact?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_emergency_information_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_emergency_information_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          event_role: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_role?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_role?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_onboarding_progress: {
        Row: {
          completed_at: string
          event_id: string
          step: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          event_id: string
          step: string
          user_id: string
        }
        Update: {
          completed_at?: string
          event_id?: string
          step?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_onboarding_progress_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_onboarding_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_report_snapshots: {
        Row: {
          event_id: string
          generated_at: string
          generated_by: string | null
          generation_kind: string
          id: string
          snapshot: Json
        }
        Insert: {
          event_id: string
          generated_at?: string
          generated_by?: string | null
          generation_kind?: string
          id?: string
          snapshot: Json
        }
        Update: {
          event_id?: string
          generated_at?: string
          generated_by?: string | null
          generation_kind?: string
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_report_snapshots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_report_snapshots_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          sections: string[]
          source_event_id: string | null
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sections?: string[]
          source_event_id?: string | null
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sections?: string[]
          source_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_templates_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          checkin_radius_m: number
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string
          end_date: string
          facebook_event_url: string | null
          gps_coordinates: unknown
          id: string
          image_url: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          onboarding_required: boolean
          start_at: string
          start_date: string
          status: string
          timezone: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          address?: string | null
          checkin_radius_m?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at: string
          end_date: string
          facebook_event_url?: string | null
          gps_coordinates?: unknown
          id?: string
          image_url?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          onboarding_required?: boolean
          start_at: string
          start_date: string
          status?: string
          timezone?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          address?: string | null
          checkin_radius_m?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string
          end_date?: string
          facebook_event_url?: string | null
          gps_coordinates?: unknown
          id?: string
          image_url?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          onboarding_required?: boolean
          start_at?: string
          start_date?: string
          status?: string
          timezone?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_rollouts: {
        Row: {
          audience: string
          enabled: boolean
          feature_key: string
          notes: string | null
          rollout_percentage: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience?: string
          enabled?: boolean
          feature_key: string
          notes?: string | null
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string
          enabled?: boolean
          feature_key?: string
          notes?: string | null
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_rollouts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_taken: string | null
          category: string
          created_at: string
          description: string
          escalated_at: string | null
          escalation_reason: string | null
          event_id: string | null
          gps_accuracy_m: number | null
          gps_coordinates: unknown
          id: string
          latitude: number | null
          longitude: number | null
          message: string
          people_involved: string | null
          photo_path: string | null
          photo_url: string | null
          reporter_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          responsible_lead_id: string | null
          status: string
          updated_at: string
          urgency: string
          user_id: string
          workplace_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_taken?: string | null
          category?: string
          created_at?: string
          description: string
          escalated_at?: string | null
          escalation_reason?: string | null
          event_id?: string | null
          gps_accuracy_m?: number | null
          gps_coordinates?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          message: string
          people_involved?: string | null
          photo_path?: string | null
          photo_url?: string | null
          reporter_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsible_lead_id?: string | null
          status?: string
          updated_at?: string
          urgency?: string
          user_id: string
          workplace_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_taken?: string | null
          category?: string
          created_at?: string
          description?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          event_id?: string | null
          gps_accuracy_m?: number | null
          gps_coordinates?: unknown
          id?: string
          latitude?: number | null
          longitude?: number | null
          message?: string
          people_involved?: string | null
          photo_path?: string | null
          photo_url?: string | null
          reporter_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responsible_lead_id?: string | null
          status?: string
          updated_at?: string
          urgency?: string
          user_id?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_responsible_lead_id_fkey"
            columns: ["responsible_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_issues: {
        Row: {
          closed_at: string | null
          event_id: string
          id: string
          issued_at: string
          issued_by: string
          item_id: string
          notes: string | null
          outstanding_quantity: number
          quantity: number
          updated_at: string
          user_id: string
          workplace_id: string
        }
        Insert: {
          closed_at?: string | null
          event_id: string
          id?: string
          issued_at?: string
          issued_by: string
          item_id: string
          notes?: string | null
          outstanding_quantity: number
          quantity: number
          updated_at?: string
          user_id: string
          workplace_id: string
        }
        Update: {
          closed_at?: string | null
          event_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          item_id?: string
          notes?: string | null
          outstanding_quantity?: number
          quantity?: number
          updated_at?: string
          user_id?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_issues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issues_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issues_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issues_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          asset_code: string | null
          asset_notes: string | null
          available_quantity: number
          barcode: string | null
          catalog_item_id: string | null
          category: string | null
          created_at: string
          created_by: string
          damaged_quantity: number
          event_id: string
          id: string
          is_active: boolean
          issued_quantity: number
          last_maintenance_at: string | null
          location_label: string | null
          maintenance_due_at: string | null
          missing_quantity: number
          name: string
          photo_path: string | null
          purchase_date: string | null
          reorder_threshold: number
          serial_number: string | null
          total_quantity: number
          unit_cost_cents: number | null
          updated_at: string
          workplace_id: string
        }
        Insert: {
          asset_code?: string | null
          asset_notes?: string | null
          available_quantity: number
          barcode?: string | null
          catalog_item_id?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          damaged_quantity?: number
          event_id: string
          id?: string
          is_active?: boolean
          issued_quantity?: number
          last_maintenance_at?: string | null
          location_label?: string | null
          maintenance_due_at?: string | null
          missing_quantity?: number
          name: string
          photo_path?: string | null
          purchase_date?: string | null
          reorder_threshold?: number
          serial_number?: string | null
          total_quantity: number
          unit_cost_cents?: number | null
          updated_at?: string
          workplace_id: string
        }
        Update: {
          asset_code?: string | null
          asset_notes?: string | null
          available_quantity?: number
          barcode?: string | null
          catalog_item_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          damaged_quantity?: number
          event_id?: string
          id?: string
          is_active?: boolean
          issued_quantity?: number
          last_maintenance_at?: string | null
          location_label?: string | null
          maintenance_due_at?: string | null
          missing_quantity?: number
          name?: string
          photo_path?: string | null
          purchase_date?: string | null
          reorder_threshold?: number
          serial_number?: string | null
          total_quantity?: number
          unit_cost_cents?: number | null
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "workplace_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string
          created_at: string
          event_id: string
          id: string
          issue_id: string | null
          item_id: string
          movement_type: string
          notes: string | null
          quantity: number
          target_user_id: string | null
          workplace_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_id: string
          id?: string
          issue_id?: string | null
          item_id: string
          movement_type: string
          notes?: string | null
          quantity: number
          target_user_id?: string | null
          workplace_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_id?: string
          id?: string
          issue_id?: string | null
          item_id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          target_user_id?: string | null
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inventory_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_settlement_requests: {
        Row: {
          condition: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          event_id: string
          id: string
          issue_id: string
          notes: string | null
          quantity: number
          status: string
          updated_at: string
          user_id: string
          workplace_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          event_id: string
          id?: string
          issue_id: string
          notes?: string | null
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
          workplace_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          event_id?: string
          id?: string
          issue_id?: string
          notes?: string | null
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_settlement_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_settlement_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_settlement_requests_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inventory_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_settlement_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_settlement_requests_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string
          event_id: string | null
          id: string
          is_published: boolean
          offline_critical: boolean
          title: string
          updated_at: string
          workplace_id: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by: string
          event_id?: string | null
          id?: string
          is_published?: boolean
          offline_critical?: boolean
          title: string
          updated_at?: string
          workplace_id?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string
          event_id?: string | null
          id?: string
          is_published?: boolean
          offline_critical?: boolean
          title?: string
          updated_at?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_articles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_articles_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          file_url: string
          id: string
          message_id: string
          mime_type: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          message_id: string
          mime_type?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          channel_id: string | null
          content: string | null
          created_at: string
          event_id: string | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          sender_id: string | null
          user_id: string
          workplace_id: string | null
        }
        Insert: {
          body?: string | null
          channel_id?: string | null
          content?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          sender_id?: string | null
          user_id: string
          workplace_id?: string | null
        }
        Update: {
          body?: string | null
          channel_id?: string | null
          content?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          sender_id?: string | null
          user_id?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_operation_records: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          operation_type: string
          payload: Json
          result: Json | null
          status: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id: string
          last_error?: string | null
          operation_type: string
          payload: Json
          result?: Json | null
          status?: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          operation_type?: string
          payload?: Json
          result?: Json | null
          status?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_operation_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          event_id: string
          id: string
          kind: string
          status: string
          title: string
          updated_at: string
          workplace_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_id: string
          id?: string
          kind: string
          status?: string
          title: string
          updated_at?: string
          workplace_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_id?: string
          id?: string
          kind?: string
          status?: string
          title?: string
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_checklists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_checklists_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_instruction_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          instruction_id: string
          user_id: string
          version: number
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          instruction_id: string
          user_id: string
          version: number
        }
        Update: {
          acknowledged_at?: string
          id?: string
          instruction_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_instruction_acknowledgements_instruction_id_fkey"
            columns: ["instruction_id"]
            isOneToOne: false
            referencedRelation: "personal_instructions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_instruction_acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_instructions: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          required: boolean
          title: string
          updated_at: string
          user_id: string
          version: number
          workplace_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          required?: boolean
          title: string
          updated_at?: string
          user_id: string
          version?: number
          workplace_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          required?: boolean
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_instructions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_instructions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_instructions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_instructions_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_recommendations: {
        Row: {
          applied_shift_id: string | null
          created_at: string
          created_by: string
          event_id: string
          id: string
          reasons: Json
          recommended_user_id: string
          role_name: string
          scheduled_end: string
          scheduled_start: string
          score: number
          status: string
          updated_at: string
          workplace_id: string
        }
        Insert: {
          applied_shift_id?: string | null
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          reasons?: Json
          recommended_user_id: string
          role_name?: string
          scheduled_end: string
          scheduled_start: string
          score?: number
          status?: string
          updated_at?: string
          workplace_id: string
        }
        Update: {
          applied_shift_id?: string | null
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          reasons?: Json
          recommended_user_id?: string
          role_name?: string
          scheduled_end?: string
          scheduled_start?: string
          score?: number
          status?: string
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_recommendations_applied_shift_id_fkey"
            columns: ["applied_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_recommendations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_recommendations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_recommendations_recommended_user_id_fkey"
            columns: ["recommended_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_recommendations_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_blocked: boolean
          approved: boolean
          approved_before_block: boolean | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          date_of_birth: string | null
          full_name: string | null
          home_address: string | null
          iban: string | null
          id: string
          national_register_number: string | null
          phone_number: string | null
          profile_photo_url: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          account_blocked?: boolean
          approved?: boolean
          approved_before_block?: boolean | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          home_address?: string | null
          iban?: string | null
          id: string
          national_register_number?: string | null
          phone_number?: string | null
          profile_photo_url?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          account_blocked?: boolean
          approved?: boolean
          approved_before_block?: boolean | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          home_address?: string | null
          iban?: string | null
          id?: string
          national_register_number?: string | null
          phone_number?: string | null
          profile_photo_url?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      qr_resources: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          event_id: string | null
          id: string
          resource_id: string | null
          resource_type: string
          route: string
          title: string
          updated_at: string
          workplace_id: string | null
        }
        Insert: {
          active?: boolean
          code?: string
          created_at?: string
          created_by: string
          event_id?: string | null
          id?: string
          resource_id?: string | null
          resource_type: string
          route: string
          title: string
          updated_at?: string
          workplace_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          event_id?: string | null
          id?: string
          resource_id?: string | null
          resource_type?: string
          route?: string
          title?: string
          updated_at?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_resources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_resources_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_checks: {
        Row: {
          check_type: string
          checked_at: string
          details: Json
          id: string
          status: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          details?: Json
          id?: string
          status: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          details?: Json
          id?: string
          status?: string
        }
        Relationships: []
      }
      responsible_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          event_id: string
          id: string
          user_id: string
          workplace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          user_id: string
          workplace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsible_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsible_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsible_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsible_assignments_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_ui_rules: {
        Row: {
          condition_key: string
          enabled: boolean
          feature_key: string
          group_key: string
          label: string
          role: string
          settings: Json
          sort_order: number
          updated_at: string
          updated_by: string | null
          visible: boolean
        }
        Insert: {
          condition_key?: string
          enabled?: boolean
          feature_key: string
          group_key?: string
          label: string
          role: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          visible?: boolean
        }
        Update: {
          condition_key?: string
          enabled?: boolean
          feature_key?: string
          group_key?: string
          label?: string
          role?: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      shifts: {
        Row: {
          confirmation_revision: string | null
          confirmed_at: string | null
          created_at: string
          end_time: string
          event_id: string
          id: string
          marketplace_note: string | null
          marketplace_open: boolean
          marketplace_opened_at: string | null
          marketplace_opened_by: string | null
          notes: string | null
          overlap_allowed: boolean
          responded_at: string | null
          response_reason: string | null
          response_status: string
          responsible_lead_id: string | null
          role: string | null
          role_name: string
          scheduled_end: string
          scheduled_start: string
          shift_kind: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
          workplace_id: string
        }
        Insert: {
          confirmation_revision?: string | null
          confirmed_at?: string | null
          created_at?: string
          end_time: string
          event_id: string
          id?: string
          marketplace_note?: string | null
          marketplace_open?: boolean
          marketplace_opened_at?: string | null
          marketplace_opened_by?: string | null
          notes?: string | null
          overlap_allowed?: boolean
          responded_at?: string | null
          response_reason?: string | null
          response_status?: string
          responsible_lead_id?: string | null
          role?: string | null
          role_name?: string
          scheduled_end: string
          scheduled_start: string
          shift_kind?: string
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
          workplace_id: string
        }
        Update: {
          confirmation_revision?: string | null
          confirmed_at?: string | null
          created_at?: string
          end_time?: string
          event_id?: string
          id?: string
          marketplace_note?: string | null
          marketplace_open?: boolean
          marketplace_opened_at?: string | null
          marketplace_opened_by?: string | null
          notes?: string | null
          overlap_allowed?: boolean
          responded_at?: string | null
          response_reason?: string | null
          response_status?: string
          responsible_lead_id?: string | null
          role?: string | null
          role_name?: string
          scheduled_end?: string
          scheduled_start?: string
          shift_kind?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_marketplace_opened_by_fkey"
            columns: ["marketplace_opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_responsible_lead_id_fkey"
            columns: ["responsible_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_pay_rates: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          effective_from: string
          effective_until: string | null
          employer_cost_multiplier_bps: number
          hourly_rate_cents: number
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          employer_cost_multiplier_bps?: number
          hourly_rate_cents: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          employer_cost_multiplier_bps?: number
          hourly_rate_cents?: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_by: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_user_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_id: string
          id: string
          status: string
          title: string
          updated_at: string
          workplace_id: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          workplace_id?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          workplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_corrections: {
        Row: {
          break_session_id: string | null
          corrected_at: string
          corrected_by: string
          corrected_value: string
          field_name: string
          id: string
          original_value: string
          reason: string
          user_id: string
          work_session_id: string | null
        }
        Insert: {
          break_session_id?: string | null
          corrected_at?: string
          corrected_by: string
          corrected_value: string
          field_name: string
          id?: string
          original_value: string
          reason: string
          user_id: string
          work_session_id?: string | null
        }
        Update: {
          break_session_id?: string | null
          corrected_at?: string
          corrected_by?: string
          corrected_value?: string
          field_name?: string
          id?: string
          original_value?: string
          reason?: string
          user_id?: string
          work_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_corrections_break_session_id_fkey"
            columns: ["break_session_id"]
            isOneToOne: false
            referencedRelation: "break_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_corrections_work_session_id_fkey"
            columns: ["work_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      time_review_requests: {
        Row: {
          adjusted_start: string | null
          check_in_id: string
          created_at: string
          id: string
          reason: string
          requested_start: string
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_start: string
          shift_id: string
          status: string
          user_id: string
          work_session_id: string
        }
        Insert: {
          adjusted_start?: string | null
          check_in_id: string
          created_at?: string
          id?: string
          reason: string
          requested_start: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_start: string
          shift_id: string
          status?: string
          user_id: string
          work_session_id: string
        }
        Update: {
          adjusted_start?: string | null
          check_in_id?: string
          created_at?: string
          id?: string
          reason?: string
          requested_start?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_start?: string
          shift_id?: string
          status?: string
          user_id?: string
          work_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_review_requests_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: true
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_review_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_review_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_review_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_review_requests_work_session_id_fkey"
            columns: ["work_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      upt_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "upt_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_attachments: {
        Row: {
          briefing_id: string | null
          created_at: string
          id: string
          mime_type: string
          personal_instruction_id: string | null
          storage_path: string
          task_id: string | null
          uploaded_by: string
        }
        Insert: {
          briefing_id?: string | null
          created_at?: string
          id?: string
          mime_type: string
          personal_instruction_id?: string | null
          storage_path: string
          task_id?: string | null
          uploaded_by: string
        }
        Update: {
          briefing_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          personal_instruction_id?: string | null
          storage_path?: string
          task_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_attachments_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_attachments_personal_instruction_id_fkey"
            columns: ["personal_instruction_id"]
            isOneToOne: false
            referencedRelation: "personal_instructions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          break_allowance_minutes: number
          created_at: string
          end_time: string | null
          ended_at: string | null
          event_id: string
          id: string
          shift_id: string | null
          start_gps_evidence: Json | null
          start_gps_status: string
          start_time: string
          started_at: string
          status: string
          stop_gps_evidence: Json | null
          stop_gps_status: string
          user_id: string
        }
        Insert: {
          break_allowance_minutes?: number
          created_at?: string
          end_time?: string | null
          ended_at?: string | null
          event_id: string
          id?: string
          shift_id?: string | null
          start_gps_evidence?: Json | null
          start_gps_status?: string
          start_time: string
          started_at?: string
          status?: string
          stop_gps_evidence?: Json | null
          stop_gps_status?: string
          user_id: string
        }
        Update: {
          break_allowance_minutes?: number
          created_at?: string
          end_time?: string | null
          ended_at?: string | null
          event_id?: string
          id?: string
          shift_id?: string | null
          start_gps_evidence?: Json | null
          start_gps_status?: string
          start_time?: string
          started_at?: string
          status?: string
          stop_gps_evidence?: Json | null
          stop_gps_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workplace_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          maximum_staff: number | null
          minimum_staff: number
          name: string
          sort_order: number
          target_staff: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          maximum_staff?: number | null
          minimum_staff?: number
          name: string
          sort_order?: number
          target_staff?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          maximum_staff?: number | null
          minimum_staff?: number
          name?: string
          sort_order?: number
          target_staff?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workplace_catalog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workplace_catalog_items: {
        Row: {
          catalog_workplace_id: string
          category: string | null
          created_at: string
          created_by: string | null
          default_quantity: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          catalog_workplace_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_quantity?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          catalog_workplace_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_quantity?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workplace_catalog_items_catalog_workplace_id_fkey"
            columns: ["catalog_workplace_id"]
            isOneToOne: false
            referencedRelation: "workplace_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplace_catalog_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workplace_inventory_notes: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string
          event_id: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          workplace_id: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          workplace_id: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workplace_inventory_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplace_inventory_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplace_inventory_notes_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workplace_transitions: {
        Row: {
          confirmed_at: string
          from_workplace_id: string | null
          id: string
          to_workplace_id: string
          transitioned_at: string
          user_id: string
          work_session_id: string
        }
        Insert: {
          confirmed_at?: string
          from_workplace_id?: string | null
          id?: string
          to_workplace_id: string
          transitioned_at?: string
          user_id: string
          work_session_id: string
        }
        Update: {
          confirmed_at?: string
          from_workplace_id?: string | null
          id?: string
          to_workplace_id?: string
          transitioned_at?: string
          user_id?: string
          work_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workplace_transitions_from_workplace_id_fkey"
            columns: ["from_workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplace_transitions_to_workplace_id_fkey"
            columns: ["to_workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplace_transitions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplace_transitions_work_session_id_fkey"
            columns: ["work_session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workplaces: {
        Row: {
          catalog_workplace_id: string | null
          created_at: string
          description: string | null
          event_id: string
          id: string
          is_active: boolean
          map_label: string | null
          map_x: number | null
          map_y: number | null
          maximum_staff: number | null
          minimum_staff: number
          name: string
          sort_order: number
          target_staff: number
        }
        Insert: {
          catalog_workplace_id?: string | null
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          map_label?: string | null
          map_x?: number | null
          map_y?: number | null
          maximum_staff?: number | null
          minimum_staff?: number
          name: string
          sort_order?: number
          target_staff?: number
        }
        Update: {
          catalog_workplace_id?: string | null
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          map_label?: string | null
          map_x?: number | null
          map_y?: number | null
          maximum_staff?: number | null
          minimum_staff?: number
          name?: string
          sort_order?: number
          target_staff?: number
        }
        Relationships: [
          {
            foreignKeyName: "workplaces_catalog_workplace_id_fkey"
            columns: ["catalog_workplace_id"]
            isOneToOne: false
            referencedRelation: "workplace_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplaces_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      upt_accept_shift_handover: {
        Args: { p_handover: string }
        Returns: undefined
      }
      upt_acknowledge_briefing: {
        Args: { p_briefing: string }
        Returns: undefined
      }
      upt_acknowledge_incident: {
        Args: { p_incident: string }
        Returns: undefined
      }
      upt_acknowledge_personal_instruction: {
        Args: { p_instruction: string }
        Returns: string
      }
      upt_add_operational_checklist_item: {
        Args: {
          p_checklist: string
          p_label: string
          p_required?: boolean
          p_requires_photo?: boolean
        }
        Returns: string
      }
      upt_admin_correct_time: {
        Args: {
          p_corrected_value: string
          p_field_name: string
          p_reason: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      upt_admin_login_failure: {
        Args: {
          p_ip?: string
          p_location?: string
          p_login: string
          p_user_agent?: string
        }
        Returns: Json
      }
      upt_admin_login_guard: { Args: { p_login: string }; Returns: Json }
      upt_admin_login_success: {
        Args: {
          p_ip?: string
          p_location?: string
          p_login: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      upt_admin_personnel_details: {
        Args: never
        Returns: {
          approved: boolean
          date_of_birth: string
          email: string
          full_name: string
          home_address: string
          iban: string
          id: string
          national_register_number: string
          phone_number: string
          profile_photo_url: string
          role: string
          updated_at: string
        }[]
      }
      upt_admin_personnel_details_v2: {
        Args: never
        Returns: {
          account_blocked: boolean
          approved: boolean
          blocked_at: string
          blocked_reason: string
          date_of_birth: string
          email: string
          full_name: string
          home_address: string
          iban: string
          id: string
          national_register_number: string
          phone_number: string
          profile_photo_url: string
          role: string
          updated_at: string
        }[]
      }
      upt_admin_profiles: {
        Args: never
        Returns: {
          account_blocked: boolean
          approved: boolean
          approved_before_block: boolean | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          date_of_birth: string | null
          full_name: string | null
          home_address: string | null
          iban: string | null
          id: string
          national_register_number: string | null
          phone_number: string | null
          profile_photo_url: string | null
          role: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      upt_admin_release_readiness_snapshot: {
        Args: never
        Returns: {
          active_breaks: number
          active_sessions: number
          checked_at: string
          latest_migration_version: string
          offline_failed: number
          offline_pending: number
          offline_stale: number
          open_incidents: number
          pending_checkins: number
          pending_checkouts: number
        }[]
      }
      upt_admin_review_early_start: {
        Args: { p_review: string; p_start?: string }
        Returns: string
      }
      upt_admin_set_account: {
        Args: { p_approved: boolean; p_role: string; p_user: string }
        Returns: undefined
      }
      upt_admin_set_personnel_block: {
        Args: { p_blocked: boolean; p_reason?: string; p_user: string }
        Returns: undefined
      }
      upt_admin_system_health: {
        Args: never
        Returns: {
          active_breaks: number
          active_sessions: number
          approved_users: number
          checked_at: string
          enabled_push_subscriptions: number
          notifications_24h: number
          offline_failed: number
          offline_operations_24h: number
          offline_pending: number
          offline_stale: number
          offline_synced_24h: number
          open_incidents: number
          pending_checkins: number
          pending_checkouts: number
          recent_audit_24h: number
          unread_notifications: number
        }[]
      }
      upt_apply_event_template: {
        Args: {
          p_address?: string
          p_end: string
          p_name: string
          p_start: string
          p_template: string
          p_venue?: string
        }
        Returns: string
      }
      upt_apply_planning_recommendation: {
        Args: { p_recommendation: string }
        Returns: string
      }
      upt_archive_event_document: {
        Args: { p_document: string }
        Returns: string
      }
      upt_archive_workplace_inventory_note: {
        Args: { p_note: string }
        Returns: undefined
      }
      upt_assign_task: {
        Args: { p_task: string; p_user: string }
        Returns: string
      }
      upt_attach_incident_photo: {
        Args: { p_incident: string; p_operation: string; p_photo_path: string }
        Returns: string
      }
      upt_audit_export: { Args: never; Returns: undefined }
      upt_can_access_workplace: {
        Args: { p_event: string; p_workplace: string }
        Returns: boolean
      }
      upt_can_manage_task: {
        Args: { p_task: string; p_uid?: string }
        Returns: boolean
      }
      upt_can_read_channel: { Args: { p_channel: string }; Returns: boolean }
      upt_can_read_profile_photo: { Args: { p_path: string }; Returns: boolean }
      upt_can_read_task: {
        Args: { p_task: string; p_uid?: string }
        Returns: boolean
      }
      upt_cancel_inventory_settlement: {
        Args: { p_request: string }
        Returns: undefined
      }
      upt_cancel_shift: {
        Args: { p_reason?: string; p_shift: string }
        Returns: undefined
      }
      upt_cancel_shift_change: {
        Args: { p_request: string }
        Returns: undefined
      }
      upt_capture_event_template: {
        Args: { p_event: string; p_name: string; p_sections?: string[] }
        Returns: string
      }
      upt_claim_marketplace_shift: {
        Args: { p_reason: string; p_shift: string }
        Returns: string
      }
      upt_claimable_shifts: {
        Args: never
        Returns: {
          event_id: string
          event_name: string
          role_name: string
          scheduled_end: string
          scheduled_start: string
          shift_id: string
          shift_kind: string
          workplace_id: string
          workplace_name: string
        }[]
      }
      upt_close_operational_checklist: {
        Args: { p_checklist: string }
        Returns: undefined
      }
      upt_command_center: { Args: { p_event: string }; Returns: Json }
      upt_complete_event_onboarding_step: {
        Args: { p_event: string; p_step: string }
        Returns: undefined
      }
      upt_confirm_shift: { Args: { p_shift: string }; Returns: undefined }
      upt_confirm_task_assignment: {
        Args: { p_assignment: string }
        Returns: string
      }
      upt_confirm_workplace_transition: {
        Args: { p_to_workplace: string; p_work_session: string }
        Returns: string
      }
      upt_create_assigned_task: {
        Args: {
          p_description: string
          p_event: string
          p_title: string
          p_user: string
          p_workplace: string
        }
        Returns: string
      }
      upt_create_event_document: {
        Args: {
          p_audience: string
          p_description: string
          p_event: string
          p_file_name: string
          p_file_size_bytes: number
          p_kind: string
          p_mime_type: string
          p_offline_critical?: boolean
          p_storage_path: string
          p_title: string
          p_workplace: string
        }
        Returns: string
      }
      upt_create_incident: {
        Args: {
          p_accuracy_m?: number
          p_event: string
          p_latitude?: number
          p_longitude?: number
          p_message: string
          p_photo_path?: string
          p_workplace: string
        }
        Returns: string
      }
      upt_create_inventory_item: {
        Args: {
          p_category?: string
          p_name: string
          p_quantity?: number
          p_workplace: string
        }
        Returns: string
      }
      upt_create_operational_checklist: {
        Args: {
          p_description?: string
          p_event: string
          p_kind: string
          p_title: string
          p_workplace: string
        }
        Returns: string
      }
      upt_create_private_chat: { Args: { p_user: string }; Returns: string }
      upt_create_qr_resource: {
        Args: {
          p_event: string
          p_resource_id: string
          p_resource_type: string
          p_route: string
          p_title: string
          p_workplace: string
        }
        Returns: string
      }
      upt_create_shift: {
        Args: {
          p_end: string
          p_overlap_allowed?: boolean
          p_role_name: string
          p_shift_kind?: string
          p_start: string
          p_user: string
          p_workplace: string
        }
        Returns: string
      }
      upt_create_workplace_catalog: {
        Args: {
          p_description?: string
          p_maximum_staff?: number
          p_minimum_staff?: number
          p_name: string
          p_sort_order?: number
          p_target_staff?: number
        }
        Returns: string
      }
      upt_create_workplace_catalog_item: {
        Args: {
          p_category?: string
          p_name: string
          p_quantity?: number
          p_workplace: string
        }
        Returns: string
      }
      upt_create_workplace_inventory_note: {
        Args: {
          p_body: string
          p_category?: string
          p_title: string
          p_workplace: string
        }
        Returns: string
      }
      upt_crew_directory: {
        Args: never
        Returns: {
          full_name: string
          id: string
          phone_number: string
          profile_photo_url: string
        }[]
      }
      upt_current_effective_role: { Args: never; Returns: string }
      upt_current_is_owner: { Args: never; Returns: boolean }
      upt_current_work_context: {
        Args: never
        Returns: {
          event_id: string
          event_name: string
          session_id: string
          shift_id: string
          started_at: string
          workplace_id: string
          workplace_name: string
        }[]
      }
      upt_decide_check_in: {
        Args: { p_approve: boolean; p_check_in: string; p_notes?: string }
        Returns: string
      }
      upt_decide_check_out: {
        Args: { p_approve: boolean; p_check_out: string; p_notes?: string }
        Returns: string
      }
      upt_decide_inventory_settlement: {
        Args: { p_decision: string; p_note?: string; p_request: string }
        Returns: undefined
      }
      upt_decide_marketplace_claim: {
        Args: { p_claim: string; p_decision: string; p_reason?: string }
        Returns: undefined
      }
      upt_decide_shift_change: {
        Args: { p_decision: string; p_reason?: string; p_request: string }
        Returns: undefined
      }
      upt_dismiss_planning_recommendation: {
        Args: { p_recommendation: string }
        Returns: undefined
      }
      upt_duplicate_event: {
        Args: {
          p_end: string
          p_event: string
          p_name: string
          p_start: string
        }
        Returns: string
      }
      upt_effective_role: { Args: { uid?: string }; Returns: string }
      upt_event_onboarding_status: { Args: { p_event: string }; Returns: Json }
      upt_event_payroll_summary: {
        Args: { p_event: string }
        Returns: {
          break_minutes: number
          employer_cost_multiplier_bps: number
          estimate_only: boolean
          estimated_cost_cents: number
          full_name: string
          hourly_rate_cents: number
          net_minutes: number
          user_id: string
          worked_minutes: number
        }[]
      }
      upt_feature_allowed: {
        Args: { p_event?: string; p_feature: string; p_workplace?: string }
        Returns: boolean
      }
      upt_feature_visible: {
        Args: { p_event?: string; p_feature: string; p_workplace?: string }
        Returns: boolean
      }
      upt_generate_event_report: { Args: { p_event: string }; Returns: Json }
      upt_generate_planning_recommendations: {
        Args: { p_event: string }
        Returns: number
      }
      upt_geoapify_rate_limit: { Args: never; Returns: Json }
      upt_god_data_audit_list: {
        Args: { p_limit?: number; p_token: string }
        Returns: Json
      }
      upt_god_data_catalog: { Args: { p_token: string }; Returns: Json }
      upt_god_data_mutate: {
        Args: {
          p_before: Json
          p_key: Json
          p_operation: string
          p_table: string
          p_token: string
          p_values: Json
        }
        Returns: Json
      }
      upt_god_data_rollback: {
        Args: { p_audit_id: number; p_token: string }
        Returns: Json
      }
      upt_god_data_rows: {
        Args: { p_offset?: number; p_table: string; p_token: string }
        Returns: Json
      }
      upt_god_database_connect: {
        Args: { p_secret: string; p_token: string }
        Returns: undefined
      }
      upt_god_database_disconnect: {
        Args: { p_token: string }
        Returns: undefined
      }
      upt_god_database_secret: { Args: { p_token: string }; Returns: string }
      upt_god_is_configured: { Args: never; Returns: boolean }
      upt_god_login: {
        Args: { p_login: string; p_password: string }
        Returns: string
      }
      upt_god_login_owner: { Args: never; Returns: string }
      upt_god_logout: { Args: { p_token: string }; Returns: undefined }
      upt_god_repository_connect: {
        Args: { p_secret: string; p_token: string }
        Returns: undefined
      }
      upt_god_repository_disconnect: {
        Args: { p_token: string }
        Returns: undefined
      }
      upt_god_repository_secret: { Args: { p_token: string }; Returns: string }
      upt_god_role_rules: {
        Args: { p_role: string; p_token: string }
        Returns: {
          condition_key: string
          enabled: boolean
          feature_key: string
          group_key: string
          label: string
          role: string
          settings: Json
          sort_order: number
          visible: boolean
        }[]
      }
      upt_god_save_role_rules: {
        Args: { p_role: string; p_rules: Json; p_token: string }
        Returns: undefined
      }
      upt_god_session_valid: { Args: { p_token: string }; Returns: boolean }
      upt_god_set_credentials: {
        Args: { p_login: string; p_password: string }
        Returns: undefined
      }
      upt_gps_assessment: {
        Args: {
          p_accuracy: number
          p_event: string
          p_failure?: string
          p_lat: number
          p_lon: number
        }
        Returns: Json
      }
      upt_handover_candidates: {
        Args: { p_event: string; p_workplace: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      upt_inventory_asset_by_code: {
        Args: { p_code: string }
        Returns: {
          asset_code: string
          available_quantity: number
          barcode: string
          category: string
          event_id: string
          id: string
          location_label: string
          maintenance_due_at: string
          name: string
          serial_number: string
          total_quantity: number
          workplace_id: string
        }[]
      }
      upt_inventory_health: {
        Args: never
        Returns: {
          available_quantity: number
          damaged_quantity: number
          event_id: string
          issued_quantity: number
          item_count: number
          low_stock_count: number
          missing_quantity: number
          total_quantity: number
          workplace_id: string
        }[]
      }
      upt_is_admin: { Args: { uid?: string }; Returns: boolean }
      upt_is_approved: { Args: never; Returns: boolean }
      upt_is_responsible: {
        Args: { event_uuid: string; uid?: string; workplace_uuid?: string }
        Returns: boolean
      }
      upt_issue_inventory: {
        Args: {
          p_item: string
          p_notes?: string
          p_quantity: number
          p_user: string
        }
        Returns: string
      }
      upt_manager_live_sessions: {
        Args: never
        Returns: {
          event_id: string
          session_id: string
          shift_id: string
          started_at: string
          user_id: string
          workplace_id: string
          workplace_name: string
        }[]
      }
      upt_mark_notification_read: {
        Args: { p_notification: string }
        Returns: undefined
      }
      upt_marketplace_claims: {
        Args: never
        Returns: {
          claim_id: string
          claimant_id: string
          claimant_name: string
          created_at: string
          current_assignee_id: string
          current_assignee_name: string
          event_name: string
          reason: string
          scheduled_end: string
          scheduled_start: string
          shift_id: string
          status: string
          workplace_name: string
        }[]
      }
      upt_marketplace_shifts: {
        Args: never
        Returns: {
          claim_pending: boolean
          event_id: string
          event_name: string
          marketplace_note: string
          role_name: string
          scheduled_end: string
          scheduled_start: string
          shift_id: string
          shift_kind: string
          workplace_id: string
          workplace_name: string
        }[]
      }
      upt_moderate_message: {
        Args: { p_message: string; p_reason: string }
        Returns: undefined
      }
      upt_operational_alerts: {
        Args: never
        Returns: {
          active_staff: number
          detected_at: string
          event_id: string
          id: string
          kind: string
          minimum_staff: number
          observed_minutes: number
          planned_end: string
          planned_start: string
          shift_id: string
          threshold_minutes: number
          user_id: string
          workplace_id: string
        }[]
      }
      upt_own_profile_details: {
        Args: never
        Returns: {
          date_of_birth: string
          email: string
          full_name: string
          home_address: string
          iban: string
          id: string
          national_register_number: string
          phone_number: string
          profile_photo_url: string
        }[]
      }
      upt_private_chat_peers: {
        Args: never
        Returns: {
          channel_id: string
          full_name: string
          phone_number: string
          profile_photo_url: string
          user_id: string
        }[]
      }
      upt_push_delivery_config: {
        Args: never
        Returns: {
          vapid_private_key: string
          vapid_public_key: string
          webhook_secret: string
        }[]
      }
      upt_push_public_key: { Args: never; Returns: string }
      upt_qr_request: {
        Args: {
          p_contact_confirmed?: boolean
          p_early_reason?: string
          p_remote?: boolean
        }
        Returns: Json
      }
      upt_reassign_shift: {
        Args: { p_reason: string; p_shift: string; p_user: string }
        Returns: undefined
      }
      upt_recovery_readiness: { Args: never; Returns: Json }
      upt_remove_operational_checklist_item: {
        Args: { p_item: string }
        Returns: undefined
      }
      upt_remove_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      upt_remove_task_assignment: {
        Args: { p_assignment: string }
        Returns: undefined
      }
      upt_reopen_operational_checklist: {
        Args: { p_checklist: string }
        Returns: undefined
      }
      upt_report_workplace_inventory_condition: {
        Args: {
          p_condition: string
          p_item: string
          p_notes?: string
          p_phase: string
          p_quantity: number
        }
        Returns: undefined
      }
      upt_request_check_in: {
        Args: {
          p_accuracy_m?: number
          p_event: string
          p_gps_status?: string
          p_latitude?: number
          p_longitude?: number
          p_remote?: boolean
          p_selfie_path?: string
          p_workplace: string
        }
        Returns: string
      }
      upt_request_check_out: {
        Args: { p_event: string; p_notes?: string }
        Returns: string
      }
      upt_request_inventory_settlement: {
        Args: {
          p_condition: string
          p_issue: string
          p_notes?: string
          p_quantity: number
        }
        Returns: string
      }
      upt_request_shift_change: {
        Args: {
          p_reason?: string
          p_replacement?: string
          p_shift: string
          p_target_shift?: string
          p_type: string
        }
        Returns: string
      }
      upt_resolve_incident: { Args: { p_incident: string }; Returns: undefined }
      upt_resolve_qr_resource: { Args: { p_code: string }; Returns: Json }
      upt_respond_shift: {
        Args: { p_reason?: string; p_response: string; p_shift: string }
        Returns: undefined
      }
      upt_respond_shift_change: {
        Args: { p_request: string; p_response: string }
        Returns: undefined
      }
      upt_responsible_crew_directory: {
        Args: { event_uuid: string; workplace_uuid: string }
        Returns: {
          full_name: string
          id: string
          phone_number: string
          profile_photo_url: string
        }[]
      }
      upt_responsible_event_members: {
        Args: { p_event: string; p_workplace: string }
        Returns: {
          full_name: string
          id: string
          phone_number: string
          profile_photo_url: string
        }[]
      }
      upt_restock_inventory_item: {
        Args: { p_item: string; p_notes?: string; p_quantity: number }
        Returns: undefined
      }
      upt_restore_inventory_quantity: {
        Args: {
          p_condition: string
          p_item: string
          p_notes?: string
          p_quantity: number
        }
        Returns: undefined
      }
      upt_restore_platform_configuration: {
        Args: { p_version: string }
        Returns: undefined
      }
      upt_save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
      upt_save_shift_handover: {
        Args: {
          p_equipment_notes?: string
          p_event: string
          p_incoming?: string
          p_mark_ready?: boolean
          p_notes?: string
          p_workplace: string
        }
        Returns: string
      }
      upt_send_message: {
        Args: { p_attachment_path?: string; p_body?: string; p_channel: string }
        Returns: string
      }
      upt_send_photo_message_operation: {
        Args: {
          p_attachment_path: string
          p_body: string
          p_channel: string
          p_operation: string
        }
        Returns: string
      }
      upt_set_admin_role_mode: { Args: { p_role: string }; Returns: string }
      upt_set_event_availability_extended: {
        Args: {
          p_breakdown: boolean
          p_event: string
          p_response: string
          p_setup: boolean
        }
        Returns: undefined
      }
      upt_set_event_availability_window: {
        Args: {
          p_available_from?: string
          p_available_until?: string
          p_breakdown: boolean
          p_event: string
          p_notes?: string
          p_response: string
          p_setup: boolean
        }
        Returns: undefined
      }
      upt_set_feature_rollout: {
        Args: {
          p_audience?: string
          p_enabled: boolean
          p_feature_key: string
          p_notes?: string
          p_rollout_percentage?: number
        }
        Returns: undefined
      }
      upt_set_operational_checklist_item: {
        Args: { p_complete: boolean; p_item: string; p_photo_path?: string }
        Returns: undefined
      }
      upt_set_shift_marketplace: {
        Args: { p_note?: string; p_open: boolean; p_shift: string }
        Returns: undefined
      }
      upt_settle_inventory_issue: {
        Args: {
          p_condition: string
          p_issue: string
          p_notes?: string
          p_quantity: number
        }
        Returns: undefined
      }
      upt_shift_change_candidates: {
        Args: { p_shift: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      upt_shift_change_requests: {
        Args: never
        Returns: {
          created_at: string
          decided_at: string
          decision_reason: string
          event_id: string
          id: string
          is_stale: boolean
          reason: string
          replacement_name: string
          replacement_responded_at: string
          replacement_response: string
          replacement_user_id: string
          requester_id: string
          requester_name: string
          shift_id: string
          source_role_name: string
          source_scheduled_end: string
          source_scheduled_start: string
          source_workplace_name: string
          status: string
          target_role_name: string
          target_scheduled_end: string
          target_scheduled_start: string
          target_shift_id: string
          target_workplace_name: string
          type: string
          updated_at: string
          workplace_id: string
        }[]
      }
      upt_shift_handover_inventory_snapshots: {
        Args: never
        Returns: {
          handover_id: string
          inventory_snapshot: Json
        }[]
      }
      upt_shift_handovers: {
        Args: never
        Returns: {
          accepted_at: string
          created_at: string
          equipment_notes: string
          event_id: string
          id: string
          incoming_name: string
          incoming_responsible_id: string
          notes: string
          open_incident_ids: string[]
          open_task_ids: string[]
          outgoing_name: string
          outgoing_responsible_id: string
          ready_at: string
          status: string
          updated_at: string
          workplace_id: string
        }[]
      }
      upt_snapshot_platform_configuration: {
        Args: { p_note?: string }
        Returns: string
      }
      upt_staff_workplace_live_status: {
        Args: never
        Returns: {
          full_name: string
          session_id: string
          status: string
          user_id: string
          workplace_id: string
          workplace_name: string
        }[]
      }
      upt_start_break: { Args: { p_work_session: string }; Returns: string }
      upt_start_work: {
        Args: { p_event: string; p_shift?: string }
        Returns: string
      }
      upt_stop_break: { Args: { p_break: string }; Returns: undefined }
      upt_stop_work: { Args: { p_work_session: string }; Returns: undefined }
      upt_swap_candidates: {
        Args: { p_shift: string }
        Returns: {
          full_name: string
          role_name: string
          scheduled_end: string
          scheduled_start: string
          target_shift_id: string
          user_id: string
          workplace_name: string
        }[]
      }
      upt_sync_operation: {
        Args: { p_id: string; p_payload: Json; p_type: string }
        Returns: Json
      }
      upt_sync_workplace_catalog_to_event: {
        Args: { p_event: string }
        Returns: Json
      }
      upt_update_inventory_asset_metadata: {
        Args: {
          p_asset_code?: string
          p_barcode?: string
          p_item: string
          p_last_maintenance_at?: string
          p_location_label?: string
          p_maintenance_due_at?: string
          p_notes?: string
          p_photo_path?: string
          p_purchase_date?: string
          p_reorder_threshold?: number
          p_serial_number?: string
          p_unit_cost_cents?: number
        }
        Returns: undefined
      }
      upt_update_own_profile: {
        Args: {
          p_date_of_birth?: string
          p_full_name: string
          p_home_address?: string
          p_iban?: string
          p_national_register_number?: string
          p_phone_number?: string
          p_profile_photo_path?: string
        }
        Returns: undefined
      }
      upt_update_shift: {
        Args: {
          p_end: string
          p_overlap_allowed?: boolean
          p_role_name: string
          p_shift: string
          p_shift_kind?: string
          p_start: string
        }
        Returns: undefined
      }
      upt_update_task_status: {
        Args: { p_assignment: string; p_status: string }
        Returns: string
      }
      upt_update_workplace_catalog: {
        Args: {
          p_description?: string
          p_is_active?: boolean
          p_maximum_staff?: number
          p_minimum_staff?: number
          p_name: string
          p_sort_order?: number
          p_target_staff?: number
          p_workplace: string
        }
        Returns: undefined
      }
      upt_update_workplace_catalog_item: {
        Args: {
          p_category?: string
          p_is_active?: boolean
          p_item: string
          p_name: string
          p_quantity?: number
        }
        Returns: undefined
      }
      upt_upsert_event_emergency_information: {
        Args: {
          p_assembly_point?: string
          p_emergency_number: string
          p_event: string
          p_first_aid_contact?: string
          p_procedure?: string
          p_security_contact?: string
        }
        Returns: undefined
      }
      upt_work_session_time_summary: {
        Args: { p_work_session: string }
        Returns: {
          active_break: boolean
          break_allowance_seconds: number
          break_balance_seconds: number
          break_seconds: number
          excess_break_seconds: number
          gross_seconds: number
          net_payable_seconds: number
          regular_break_seconds: number
          work_session_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
