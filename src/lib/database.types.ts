export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          name: string
          logo: string | null
        }
        Insert: {
          id?: string
          name: string
          logo?: string | null
        }
        Update: {
          id?: string
          name?: string
          logo?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          client_id: string | null
          name: string
          type: string
          status: string
          progress: number | null
          project_size: string | null
          system_type: string | null
          location: string | null
          location_validated: boolean | null
          code_name: string | null
          epc: string | null
          o_and_m: string | null
          point_of_contact: string | null
          notes: string | null
          scopes: Json | null
          assigned_personnel: string[] | null
          site_lead_ids: string[] | null
          has_no_defined_scope: boolean | null
          disciplines: string[] | null
          start_date: string | null
          expected_duration: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          name: string
          type: string
          status: string
          progress?: number | null
          project_size?: string | null
          system_type?: string | null
          location?: string | null
          location_validated?: boolean | null
          code_name?: string | null
          epc?: string | null
          o_and_m?: string | null
          point_of_contact?: string | null
          notes?: string | null
          scopes?: Json | null
          assigned_personnel?: string[] | null
          site_lead_ids?: string[] | null
          has_no_defined_scope?: boolean | null
          disciplines?: string[] | null
          start_date?: string | null
          expected_duration?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          name?: string
          type?: string
          status?: string
          progress?: number | null
          project_size?: string | null
          system_type?: string | null
          location?: string | null
          location_validated?: boolean | null
          code_name?: string | null
          epc?: string | null
          o_and_m?: string | null
          point_of_contact?: string | null
          notes?: string | null
          scopes?: Json | null
          assigned_personnel?: string[] | null
          site_lead_ids?: string[] | null
          has_no_defined_scope?: boolean | null
          disciplines?: string[] | null
          start_date?: string | null
          expected_duration?: string | null
          created_at?: string | null
        }
      }
      personnel: {
        Row: {
          id: string
          name: string
          email: string | null
          position: string | null
          employee_number: string | null
          phone_number: string | null
          app_role: string | null
          status: string | null
          certifications: Json | null
          image: string | null
          prevailing_wage: boolean | null
          bench_exempt: boolean | null
          supervisor_id: string | null
          manager_id: string | null
          client_id: string | null
          dbo: string | null
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          position?: string | null
          employee_number?: string | null
          phone_number?: string | null
          app_role?: string | null
          status?: string | null
          certifications?: Json | null
          image?: string | null
          prevailing_wage?: boolean | null
          bench_exempt?: boolean | null
          supervisor_id?: string | null
          manager_id?: string | null
          client_id?: string | null
          dbo?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          position?: string | null
          employee_number?: string | null
          phone_number?: string | null
          app_role?: string | null
          status?: string | null
          certifications?: Json | null
          image?: string | null
          prevailing_wage?: boolean | null
          bench_exempt?: boolean | null
          supervisor_id?: string | null
          manager_id?: string | null
          client_id?: string | null
          dbo?: string | null
        }
      }
      reports: {
        Row: {
          id: string
          project_id: string | null
          client_id: string | null
          date: string
          state: string
          schedule: Json | null
          weather: Json | null
          location: string | null
          equipment: Json | null
          custom_sections: Json | null
          comments: Json | null
          labor: Json | null
          media: Json | null
          occurrences: Json | null
          checklists: Json | null
          sub_report_ids: string[] | null
          attachments: Json | null
          external_attachments: Json | null
          notes: string | null
          signatures: Json | null
          used_tools: Json | null
          health: number | null
          activity_logs: Json | null
          discipline: string | null
          created_at: string | null
          created_by: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          client_id?: string | null
          date: string
          state: string
          schedule?: Json | null
          weather?: Json | null
          location?: string | null
          equipment?: Json | null
          custom_sections?: Json | null
          comments?: Json | null
          labor?: Json | null
          media?: Json | null
          occurrences?: Json | null
          checklists?: Json | null
          sub_report_ids?: string[] | null
          attachments?: Json | null
          external_attachments?: Json | null
          notes?: string | null
          signatures?: Json | null
          used_tools?: Json | null
          health?: number | null
          activity_logs?: Json | null
          discipline?: string | null
          created_at?: string | null
          created_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          client_id?: string | null
          date?: string
          state?: string
          schedule?: Json | null
          weather?: Json | null
          location?: string | null
          equipment?: Json | null
          custom_sections?: Json | null
          comments?: Json | null
          labor?: Json | null
          media?: Json | null
          occurrences?: Json | null
          checklists?: Json | null
          sub_report_ids?: string[] | null
          attachments?: Json | null
          external_attachments?: Json | null
          notes?: string | null
          signatures?: Json | null
          used_tools?: Json | null
          health?: number | null
          activity_logs?: Json | null
          discipline?: string | null
          created_at?: string | null
          created_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
      }
      timesheets: {
        Row: {
          id: string
          personnel_id: string | null
          project_id: string | null
          date: string
          time_in: string | null
          time_out: string | null
          hours: number | null
          type: string | null
          classification: string | null
          notes: string | null
          status: string | null
          approved_by: string | null
          signature: string | null
          punches: Json | null
          gps_verified: boolean | null
          source: string | null
          manual_reason: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          date: string
          time_in?: string | null
          time_out?: string | null
          hours?: number | null
          type?: string | null
          classification?: string | null
          notes?: string | null
          status?: string | null
          approved_by?: string | null
          signature?: string | null
          punches?: Json | null
          gps_verified?: boolean | null
          source?: string | null
          manual_reason?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          date?: string
          time_in?: string | null
          time_out?: string | null
          hours?: number | null
          type?: string | null
          classification?: string | null
          notes?: string | null
          status?: string | null
          approved_by?: string | null
          signature?: string | null
          punches?: Json | null
          gps_verified?: boolean | null
          source?: string | null
          manual_reason?: string | null
          created_at?: string | null
        }
      }
      tools: {
        Row: {
          id: string
          name: string
          model: string | null
          serial_number: string | null
          certification_expiry: string | null
          assigned_project_id: string | null
          history: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          model?: string | null
          serial_number?: string | null
          certification_expiry?: string | null
          assigned_project_id?: string | null
          history?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          model?: string | null
          serial_number?: string | null
          certification_expiry?: string | null
          assigned_project_id?: string | null
          history?: Json | null
          created_at?: string | null
        }
      }
      scope_templates: {
        Row: {
          id: string
          name: string
          activities: Json | null
        }
        Insert: {
          id?: string
          name: string
          activities?: Json | null
        }
        Update: {
          id?: string
          name?: string
          activities?: Json | null
        }
      }
      sub_report_templates: {
        Row: {
          id: string
          name: string
          fields: Json | null
        }
        Insert: {
          id?: string
          name: string
          fields?: Json | null
        }
        Update: {
          id?: string
          name?: string
          fields?: Json | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_user: {
        Args: {
          user_email: string
          user_name: string
          user_role: string
          user_password: string
        }
        Returns: string
      }
      admin_update_user: {
        Args: {
          target_user_id: string
          new_email: string
          new_role: string
          new_password: string
        }
        Returns: void
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
