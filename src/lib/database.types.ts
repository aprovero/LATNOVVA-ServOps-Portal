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
          code_name: string | null
          scopes: Json | null
          assigned_personnel: string[] | null
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
          code_name?: string | null
          scopes?: Json | null
          assigned_personnel?: string[] | null
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
          code_name?: string | null
          scopes?: Json | null
          assigned_personnel?: string[] | null
          created_at?: string | null
        }
      }
      personnel: {
        Row: {
          id: string
          name: string
          position: string | null
          employee_number: string | null
          phone_number: string | null
          app_role: string | null
          status: string | null
          certifications: Json | null
          image: string | null
          prevailing_wage: boolean | null
        }
        Insert: {
          id?: string
          name: string
          position?: string | null
          employee_number?: string | null
          phone_number?: string | null
          app_role?: string | null
          status?: string | null
          certifications?: Json | null
        }
        Update: {
          id?: string
          name?: string
          position?: string | null
          employee_number?: string | null
          phone_number?: string | null
          app_role?: string | null
          status?: string | null
          certifications?: Json | null
        }
      }
      reports: {
        Row: {
          id: string
          project_id: string | null
          client_id: string | null
          date: string
          state: string
          weather: Json | null
          equipment: Json | null
          custom_sections: Json | null
          comments: Json | null
          labor: Json | null
          notes: string | null
          health: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          client_id?: string | null
          date: string
          state: string
          weather?: Json | null
          equipment?: Json | null
          custom_sections?: Json | null
          comments?: Json | null
          labor?: Json | null
          notes?: string | null
          health?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          client_id?: string | null
          date?: string
          state?: string
          weather?: Json | null
          equipment?: Json | null
          custom_sections?: Json | null
          comments?: Json | null
          labor?: Json | null
          notes?: string | null
          health?: number | null
          created_at?: string | null
        }
      }
      timesheets: {
        Row: {
          id: string
          personnel_id: string | null
          project_id: string | null
          date: string
          hours: number | null
          type: string | null
          status: string | null
          punches: Json | null
          gps_verified: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          date: string
          hours?: number | null
          type?: string | null
          status?: string | null
          punches?: Json | null
          gps_verified?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          date?: string
          hours?: number | null
          type?: string | null
          status?: string | null
          punches?: Json | null
          gps_verified?: boolean | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
