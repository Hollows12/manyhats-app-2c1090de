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
      ai_estimate_recommendations: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          notes: string | null
          payload: Json
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["ai_recommendation_status"]
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          payload: Json
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ai_recommendation_status"]
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          payload?: Json
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ai_recommendation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_estimate_recommendations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          approved_at: string | null
          client_signature: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          number: number
          price_change: number
          project_id: string
          reason: string | null
          status: string
          timeline_change_days: number
        }
        Insert: {
          approved_at?: string | null
          client_signature?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          number?: number
          price_change?: number
          project_id: string
          reason?: string | null
          status?: string
          timeline_change_days?: number
        }
        Update: {
          approved_at?: string | null
          client_signature?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          number?: number
          price_change?: number
          project_id?: string
          reason?: string | null
          status?: string
          timeline_change_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          county: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      concept_requests: {
        Row: {
          approved_for_proposal: boolean
          created_at: string
          created_by: string | null
          generated_image_path: string | null
          id: string
          measurement_notes: string | null
          must_keep: string | null
          project_id: string
          prompt: string
          requested_changes: string | null
          source_photo_id: string | null
          status: Database["public"]["Enums"]["concept_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_for_proposal?: boolean
          created_at?: string
          created_by?: string | null
          generated_image_path?: string | null
          id?: string
          measurement_notes?: string | null
          must_keep?: string | null
          project_id: string
          prompt: string
          requested_changes?: string | null
          source_photo_id?: string | null
          status?: Database["public"]["Enums"]["concept_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_for_proposal?: boolean
          created_at?: string
          created_by?: string | null
          generated_image_path?: string | null
          id?: string
          measurement_notes?: string | null
          must_keep?: string | null
          project_id?: string
          prompt?: string
          requested_changes?: string | null
          source_photo_id?: string | null
          status?: Database["public"]["Enums"]["concept_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_requests_source_photo_id_fkey"
            columns: ["source_photo_id"]
            isOneToOne: false
            referencedRelation: "project_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      container_builds: {
        Row: {
          airbnb_use_case: string | null
          container_count: number | null
          container_size: string | null
          deck_patio: string | null
          details: Json
          exterior_paint: string | null
          foundation_type: string | null
          id: string
          insulation: string | null
          interior_finish: string | null
          landscaping: string | null
          layout_notes: string | null
          project_id: string
          roof_type: string | null
          signage: string | null
          updated_at: string
          utility_plan: string | null
        }
        Insert: {
          airbnb_use_case?: string | null
          container_count?: number | null
          container_size?: string | null
          deck_patio?: string | null
          details?: Json
          exterior_paint?: string | null
          foundation_type?: string | null
          id?: string
          insulation?: string | null
          interior_finish?: string | null
          landscaping?: string | null
          layout_notes?: string | null
          project_id: string
          roof_type?: string | null
          signage?: string | null
          updated_at?: string
          utility_plan?: string | null
        }
        Update: {
          airbnb_use_case?: string | null
          container_count?: number | null
          container_size?: string | null
          deck_patio?: string | null
          details?: Json
          exterior_paint?: string | null
          foundation_type?: string | null
          id?: string
          insulation?: string | null
          interior_finish?: string | null
          landscaping?: string | null
          layout_notes?: string | null
          project_id?: string
          roof_type?: string | null
          signage?: string | null
          updated_at?: string
          utility_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_service_areas: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          is_primary: boolean
          radius_mi: number
          updated_at: string
          zip: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          radius_mi?: number
          updated_at?: string
          zip: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          radius_mi?: number
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          client_communication: string | null
          created_at: string
          created_by: string | null
          crew_notes: string | null
          equipment_notes: string | null
          hours_worked: number | null
          id: string
          log_date: string
          material_notes: string | null
          progress_notes: string | null
          project_id: string
          subcontractor_notes: string | null
          weather: string | null
        }
        Insert: {
          client_communication?: string | null
          created_at?: string
          created_by?: string | null
          crew_notes?: string | null
          equipment_notes?: string | null
          hours_worked?: number | null
          id?: string
          log_date?: string
          material_notes?: string | null
          progress_notes?: string | null
          project_id: string
          subcontractor_notes?: string | null
          weather?: string | null
        }
        Update: {
          client_communication?: string | null
          created_at?: string
          created_by?: string | null
          crew_notes?: string | null
          equipment_notes?: string | null
          hours_worked?: number | null
          id?: string
          log_date?: string
          material_notes?: string | null
          progress_notes?: string | null
          project_id?: string
          subcontractor_notes?: string | null
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          paid_at: string | null
          percentage: number | null
          project_id: string
          proposal_id: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          percentage?: number | null
          project_id: string
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          percentage?: number | null
          project_id?: string
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          category: Database["public"]["Enums"]["estimate_category"]
          created_at: string
          description: string
          estimate_id: string
          id: string
          quantity: number
          sort_order: number
          total: number | null
          unit: string
          unit_cost: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["estimate_category"]
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          quantity?: number
          sort_order?: number
          total?: number | null
          unit?: string
          unit_cost?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["estimate_category"]
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          quantity?: number
          sort_order?: number
          total?: number | null
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          contingency_pct: number
          created_at: string
          created_by: string | null
          estimate_number: string | null
          grand_total: number
          id: string
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: Database["public"]["Enums"]["invoice_status"] | null
          invoiced_at: string | null
          markup_pct: number
          notes: string | null
          project_id: string
          status: string
          subtotal: number
          tax_pct: number
          updated_at: string
        }
        Insert: {
          contingency_pct?: number
          created_at?: string
          created_by?: string | null
          estimate_number?: string | null
          grand_total?: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"] | null
          invoiced_at?: string | null
          markup_pct?: number
          notes?: string | null
          project_id: string
          status?: string
          subtotal?: number
          tax_pct?: number
          updated_at?: string
        }
        Update: {
          contingency_pct?: number
          created_at?: string
          created_by?: string | null
          estimate_number?: string | null
          grand_total?: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"] | null
          invoiced_at?: string | null
          markup_pct?: number
          notes?: string | null
          project_id?: string
          status?: string
          subtotal?: number
          tax_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      firecrawl_jobs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          kind: Database["public"]["Enums"]["firecrawl_job_kind"]
          result_summary: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["firecrawl_job_status"]
          target: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["firecrawl_job_kind"]
          result_summary?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["firecrawl_job_status"]
          target: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["firecrawl_job_kind"]
          result_summary?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["firecrawl_job_status"]
          target?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      historic_projects: {
        Row: {
          building_age: string | null
          details: Json
          grant_notes: string | null
          historic_notes: string | null
          id: string
          masonry_damage: string | null
          phased_plan: string | null
          project_id: string
          safety_concerns: string | null
          structural_concerns: string | null
          updated_at: string
          water_intrusion: string | null
          window_condition: string | null
        }
        Insert: {
          building_age?: string | null
          details?: Json
          grant_notes?: string | null
          historic_notes?: string | null
          id?: string
          masonry_damage?: string | null
          phased_plan?: string | null
          project_id: string
          safety_concerns?: string | null
          structural_concerns?: string | null
          updated_at?: string
          water_intrusion?: string | null
          window_condition?: string | null
        }
        Update: {
          building_age?: string | null
          details?: Json
          grant_notes?: string | null
          historic_notes?: string | null
          id?: string
          masonry_damage?: string | null
          phased_plan?: string | null
          project_id?: string
          safety_concerns?: string | null
          structural_concerns?: string | null
          updated_at?: string
          water_intrusion?: string | null
          window_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historic_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      home_builds: {
        Row: {
          closeout: Json
          design: Json
          id: string
          preconstruction: Json
          project_id: string
          selections: Json
          updated_at: string
        }
        Insert: {
          closeout?: Json
          design?: Json
          id?: string
          preconstruction?: Json
          project_id: string
          selections?: Json
          updated_at?: string
        }
        Update: {
          closeout?: Json
          design?: Json
          id?: string
          preconstruction?: Json
          project_id?: string
          selections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          sort_order?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          created_at: string
          created_by: string | null
          due_date: string | null
          estimate_id: string | null
          id: string
          invoice_date: string
          invoice_number: string
          is_final: boolean
          notes: string | null
          project_id: string
          proposal_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          balance_due?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          is_final?: boolean
          notes?: string | null
          project_id: string
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          balance_due?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_final?: boolean
          notes?: string | null
          project_id?: string
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      job_costs: {
        Row: {
          actual: number
          category: Database["public"]["Enums"]["estimate_category"]
          estimated: number
          id: string
          notes: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          actual?: number
          category: Database["public"]["Enums"]["estimate_category"]
          estimated?: number
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          actual?: number
          category?: Database["public"]["Enums"]["estimate_category"]
          estimated?: number
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          is_complete: boolean
          notes: string | null
          project_id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_complete?: boolean
          notes?: string | null
          project_id: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_complete?: boolean
          notes?: string | null
          project_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_docs: {
        Row: {
          body_md: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["knowledge_doc_kind"]
          retrieved_at: string
          source_url: string | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body_md: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["knowledge_doc_kind"]
          retrieved_at?: string
          source_url?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["knowledge_doc_kind"]
          retrieved_at?: string
          source_url?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_entries: {
        Row: {
          actual_total: number | null
          created_at: string
          created_by: string | null
          estimated_total: number | null
          final_scope: string | null
          id: string
          labor_hours: number | null
          lessons_learned: string | null
          margin_pct: number | null
          project_id: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          tags: string[]
          title: string
        }
        Insert: {
          actual_total?: number | null
          created_at?: string
          created_by?: string | null
          estimated_total?: number | null
          final_scope?: string | null
          id?: string
          labor_hours?: number | null
          lessons_learned?: string | null
          margin_pct?: number | null
          project_id?: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          tags?: string[]
          title: string
        }
        Update: {
          actual_total?: number | null
          created_at?: string
          created_by?: string | null
          estimated_total?: number | null
          final_scope?: string | null
          id?: string
          labor_hours?: number | null
          lessons_learned?: string | null
          margin_pct?: number | null
          project_id?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lidar_scans: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          measurement_summary: string | null
          project_id: string
          scan_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          measurement_summary?: string | null
          project_id: string
          scan_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          measurement_summary?: string | null
          project_id?: string
          scan_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lidar_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_costs: {
        Row: {
          category: string | null
          county: string | null
          created_at: string
          id: string
          item_name: string
          last_updated: string
          state: string | null
          supplier: string | null
          unit: string
          unit_cost: number
          zip: string | null
        }
        Insert: {
          category?: string | null
          county?: string | null
          created_at?: string
          id?: string
          item_name: string
          last_updated?: string
          state?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          zip?: string | null
        }
        Update: {
          category?: string | null
          county?: string | null
          created_at?: string
          id?: string
          item_name?: string
          last_updated?: string
          state?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          zip?: string | null
        }
        Relationships: []
      }
      material_prices: {
        Row: {
          availability: string | null
          created_at: string
          id: string
          material_id: string
          price: number
          price_confidence: number | null
          price_date: string
          product_url: string | null
          retrieved_at: string
          source: string
          supplier_id: string | null
          unit: string
        }
        Insert: {
          availability?: string | null
          created_at?: string
          id?: string
          material_id: string
          price: number
          price_confidence?: number | null
          price_date?: string
          product_url?: string | null
          retrieved_at?: string
          source?: string
          supplier_id?: string | null
          unit: string
        }
        Update: {
          availability?: string | null
          created_at?: string
          id?: string
          material_id?: string
          price?: number
          price_confidence?: number | null
          price_date?: string
          product_url?: string | null
          retrieved_at?: string
          source?: string
          supplier_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          colors: string[]
          compatible_with: string[]
          coverage: string | null
          created_at: string
          description: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          install_instructions: string | null
          manufacturer: string | null
          name: string
          sds_url: string | null
          sku: string | null
          source_url: string | null
          spec: Json
          tds_url: string | null
          upc: string | null
          updated_at: string
          warranty: string | null
          weight: string | null
          yield: string | null
        }
        Insert: {
          colors?: string[]
          compatible_with?: string[]
          coverage?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          install_instructions?: string | null
          manufacturer?: string | null
          name: string
          sds_url?: string | null
          sku?: string | null
          source_url?: string | null
          spec?: Json
          tds_url?: string | null
          upc?: string | null
          updated_at?: string
          warranty?: string | null
          weight?: string | null
          yield?: string | null
        }
        Update: {
          colors?: string[]
          compatible_with?: string[]
          coverage?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          install_instructions?: string | null
          manufacturer?: string | null
          name?: string
          sds_url?: string | null
          sku?: string | null
          source_url?: string | null
          spec?: Json
          tds_url?: string | null
          upc?: string | null
          updated_at?: string
          warranty?: string | null
          weight?: string | null
          yield?: string | null
        }
        Relationships: []
      }
      measurements: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_confirmed: boolean
          notes: string | null
          project_id: string
          quantity: number
          unit: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_confirmed?: boolean
          notes?: string | null
          project_id: string
          quantity?: number
          unit?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_confirmed?: boolean
          notes?: string | null
          project_id?: string
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          is_void: boolean
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference_number: string | null
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          is_void?: boolean
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          is_void?: boolean
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      preferred_vendors: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          supplier_id: string
          trade: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          supplier_id: string
          trade?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          supplier_id?: string
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preferred_vendors_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_rates: {
        Row: {
          created_at: string
          crew_size: number
          equipment: string | null
          id: string
          labor_hours_per_unit: number | null
          notes: string | null
          rate_per_day: number | null
          unit: string
          work_type: string
        }
        Insert: {
          created_at?: string
          crew_size?: number
          equipment?: string | null
          id?: string
          labor_hours_per_unit?: number | null
          notes?: string | null
          rate_per_day?: number | null
          unit?: string
          work_type: string
        }
        Update: {
          created_at?: string
          crew_size?: number
          equipment?: string | null
          id?: string
          labor_hours_per_unit?: number | null
          notes?: string | null
          rate_per_day?: number | null
          unit?: string
          work_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          client_id: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_billings: {
        Row: {
          amount_due: number
          approved_at: string | null
          approved_by: string | null
          billing_number: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          percent_complete: number
          project_id: string
          retainage: number
          status: Database["public"]["Enums"]["progress_billing_status"]
          updated_at: string
        }
        Insert: {
          amount_due?: number
          approved_at?: string | null
          approved_by?: string | null
          billing_number?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          percent_complete?: number
          project_id: string
          retainage?: number
          status?: Database["public"]["Enums"]["progress_billing_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          approved_at?: string | null
          approved_by?: string | null
          billing_number?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          percent_complete?: number
          project_id?: string
          retainage?: number
          status?: Database["public"]["Enums"]["progress_billing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_billings_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_billings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_real_site_photo: boolean
          project_id: string
          storage_path: string
          tags: string[]
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_real_site_photo?: boolean
          project_id: string
          storage_path: string
          tags?: string[]
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_real_site_photo?: boolean
          project_id?: string
          storage_path?: string
          tags?: string[]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          city: string | null
          client_id: string
          county: string | null
          created_at: string
          created_by: string | null
          desired_timeline: string | null
          id: string
          job_address: string | null
          measurement_notes: string | null
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          site_notes: string | null
          state: string | null
          status: Database["public"]["Enums"]["project_status"]
          summary: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_id: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          desired_timeline?: string | null
          id?: string
          job_address?: string | null
          measurement_notes?: string | null
          name: string
          project_type?: Database["public"]["Enums"]["project_type"]
          site_notes?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          summary?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_id?: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          desired_timeline?: string | null
          id?: string
          job_address?: string | null
          measurement_notes?: string | null
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          site_notes?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          summary?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_options: {
        Row: {
          description: string | null
          id: string
          is_recommended: boolean
          price: number
          proposal_id: string
          sort_order: number
          tier: string
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_recommended?: boolean
          price?: number
          proposal_id: string
          sort_order?: number
          tier: string
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          is_recommended?: boolean
          price?: number
          proposal_id?: string
          sort_order?: number
          tier?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_options_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_signatures: {
        Row: {
          id: string
          ip_address: string | null
          proposal_id: string
          selected_option_id: string | null
          signature_data: string | null
          signed_at: string
          signer_email: string | null
          signer_name: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          proposal_id: string
          selected_option_id?: string | null
          signature_data?: string | null
          signed_at?: string
          signer_email?: string | null
          signer_name: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          proposal_id?: string
          selected_option_id?: string | null
          signature_data?: string | null
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_signatures_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_signatures_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "proposal_options"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          attached_concept_ids: string[]
          attached_photo_ids: string[]
          created_at: string
          created_by: string | null
          exclusions: string | null
          executive_summary: string | null
          existing_conditions: string | null
          grant_friendly: boolean
          id: string
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: Database["public"]["Enums"]["invoice_status"] | null
          invoiced_at: string | null
          payment_terms: string | null
          pdf_path: string | null
          project_id: string
          proposal_number: string
          recommendation: string | null
          scope_of_work: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          timeline: string | null
          updated_at: string
          warranty_length: string | null
          warranty_notes: string | null
        }
        Insert: {
          approved_at?: string | null
          attached_concept_ids?: string[]
          attached_photo_ids?: string[]
          created_at?: string
          created_by?: string | null
          exclusions?: string | null
          executive_summary?: string | null
          existing_conditions?: string | null
          grant_friendly?: boolean
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"] | null
          invoiced_at?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          project_id: string
          proposal_number: string
          recommendation?: string | null
          scope_of_work?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          timeline?: string | null
          updated_at?: string
          warranty_length?: string | null
          warranty_notes?: string | null
        }
        Update: {
          approved_at?: string | null
          attached_concept_ids?: string[]
          attached_photo_ids?: string[]
          created_at?: string
          created_by?: string | null
          exclusions?: string | null
          executive_summary?: string | null
          existing_conditions?: string | null
          grant_friendly?: boolean
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"] | null
          invoiced_at?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          project_id?: string
          proposal_number?: string
          recommendation?: string | null
          scope_of_work?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          timeline?: string | null
          updated_at?: string
          warranty_length?: string | null
          warranty_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      septic_projects: {
        Row: {
          as_built_notes: string | null
          drainage_notes: string | null
          gps_points: string | null
          id: string
          inspection_notes: string | null
          leach_field_layout: string | null
          maintenance_notes: string | null
          permit_notes: string | null
          project_id: string
          sensor_status: Json
          setbacks: string | null
          soil_notes: string | null
          tank_location: string | null
          updated_at: string
        }
        Insert: {
          as_built_notes?: string | null
          drainage_notes?: string | null
          gps_points?: string | null
          id?: string
          inspection_notes?: string | null
          leach_field_layout?: string | null
          maintenance_notes?: string | null
          permit_notes?: string | null
          project_id: string
          sensor_status?: Json
          setbacks?: string | null
          soil_notes?: string | null
          tank_location?: string | null
          updated_at?: string
        }
        Update: {
          as_built_notes?: string | null
          drainage_notes?: string | null
          gps_points?: string | null
          id?: string
          inspection_notes?: string | null
          leach_field_layout?: string | null
          maintenance_notes?: string | null
          permit_notes?: string | null
          project_id?: string
          sensor_status?: Json
          setbacks?: string | null
          soil_notes?: string | null
          tank_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "septic_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          categories: string[]
          county: string | null
          created_at: string
          distance_mi: number | null
          hours: string | null
          id: string
          is_favorite: boolean
          last_updated: string
          name: string
          phone: string | null
          source_url: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          categories?: string[]
          county?: string | null
          created_at?: string
          distance_mi?: number | null
          hours?: string | null
          id?: string
          is_favorite?: boolean
          last_updated?: string
          name: string
          phone?: string | null
          source_url?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          categories?: string[]
          county?: string | null
          created_at?: string
          distance_mi?: number | null
          hours?: string | null
          id?: string
          is_favorite?: boolean
          last_updated?: string
          name?: string
          phone?: string | null
          source_url?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          scope_notes: string | null
          storage_path: string | null
          transcript: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          scope_notes?: string | null
          storage_path?: string | null
          transcript?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          scope_notes?: string | null
          storage_path?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      get_invitation_preview: { Args: { _token: string }; Returns: Json }
      get_public_schema_snapshot: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      project_profit_snapshot: { Args: { _project_id: string }; Returns: Json }
    }
    Enums: {
      ai_recommendation_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "crew" | "client"
      concept_status:
        | "draft"
        | "ready_to_generate"
        | "generated"
        | "approved"
        | "rejected"
      deposit_status: "pending" | "invoiced" | "paid" | "waived" | "void"
      estimate_category:
        | "labor"
        | "material"
        | "equipment"
        | "subcontractor"
        | "fuel_travel"
        | "permit"
        | "disposal"
        | "contingency"
        | "markup"
        | "other"
      firecrawl_job_kind:
        | "supplier_discovery"
        | "material_enrichment"
        | "price_refresh"
        | "knowledge_import"
      firecrawl_job_status: "queued" | "running" | "succeeded" | "failed"
      invoice_status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void"
      knowledge_doc_kind:
        | "install"
        | "spec"
        | "sds"
        | "warranty"
        | "practice"
        | "safety"
        | "other"
      payment_method:
        | "cash"
        | "check"
        | "ach"
        | "credit_card"
        | "stripe"
        | "quickbooks"
        | "other"
      progress_billing_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "invoiced"
        | "paid"
        | "void"
      project_status:
        | "lead"
        | "site_visit_scheduled"
        | "field_capture"
        | "estimating"
        | "proposal_draft"
        | "proposal_sent"
        | "approved"
        | "active"
        | "waiting_on_client"
        | "waiting_on_materials"
        | "complete"
        | "lost"
      project_type:
        | "custom_home"
        | "spec_home"
        | "barndominium"
        | "pole_barn_home"
        | "addition"
        | "garage"
        | "basement_finish"
        | "whole_home_remodel"
        | "kitchen_remodel"
        | "bathroom_remodel"
        | "outdoor_living"
        | "excavation"
        | "site_development"
        | "foundation"
        | "retaining_wall"
        | "utilities"
        | "septic_install"
        | "septic_repair"
        | "driveway"
        | "drainage"
        | "stormwater"
        | "decorative_concrete"
        | "stamped_concrete"
        | "concrete_flatwork"
        | "cmu_block"
        | "masonry_restoration"
        | "historic_restoration"
        | "chimney_repair"
        | "stone_veneer"
        | "commercial_buildout"
        | "office_renovation"
        | "retail_buildout"
        | "restaurant_buildout"
        | "museum_theater_church"
        | "container_airbnb"
        | "container_home"
        | "container_game_room"
        | "container_theater_room"
        | "hunting_cabin"
        | "short_term_rental"
        | "other"
      proposal_status:
        | "draft"
        | "ready"
        | "sent"
        | "approved"
        | "rejected"
        | "expired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_recommendation_status: ["pending", "approved", "rejected"],
      app_role: ["admin", "crew", "client"],
      concept_status: [
        "draft",
        "ready_to_generate",
        "generated",
        "approved",
        "rejected",
      ],
      deposit_status: ["pending", "invoiced", "paid", "waived", "void"],
      estimate_category: [
        "labor",
        "material",
        "equipment",
        "subcontractor",
        "fuel_travel",
        "permit",
        "disposal",
        "contingency",
        "markup",
        "other",
      ],
      firecrawl_job_kind: [
        "supplier_discovery",
        "material_enrichment",
        "price_refresh",
        "knowledge_import",
      ],
      firecrawl_job_status: ["queued", "running", "succeeded", "failed"],
      invoice_status: ["draft", "sent", "partial", "paid", "overdue", "void"],
      knowledge_doc_kind: [
        "install",
        "spec",
        "sds",
        "warranty",
        "practice",
        "safety",
        "other",
      ],
      payment_method: [
        "cash",
        "check",
        "ach",
        "credit_card",
        "stripe",
        "quickbooks",
        "other",
      ],
      progress_billing_status: [
        "draft",
        "pending_approval",
        "approved",
        "invoiced",
        "paid",
        "void",
      ],
      project_status: [
        "lead",
        "site_visit_scheduled",
        "field_capture",
        "estimating",
        "proposal_draft",
        "proposal_sent",
        "approved",
        "active",
        "waiting_on_client",
        "waiting_on_materials",
        "complete",
        "lost",
      ],
      project_type: [
        "custom_home",
        "spec_home",
        "barndominium",
        "pole_barn_home",
        "addition",
        "garage",
        "basement_finish",
        "whole_home_remodel",
        "kitchen_remodel",
        "bathroom_remodel",
        "outdoor_living",
        "excavation",
        "site_development",
        "foundation",
        "retaining_wall",
        "utilities",
        "septic_install",
        "septic_repair",
        "driveway",
        "drainage",
        "stormwater",
        "decorative_concrete",
        "stamped_concrete",
        "concrete_flatwork",
        "cmu_block",
        "masonry_restoration",
        "historic_restoration",
        "chimney_repair",
        "stone_veneer",
        "commercial_buildout",
        "office_renovation",
        "retail_buildout",
        "restaurant_buildout",
        "museum_theater_church",
        "container_airbnb",
        "container_home",
        "container_game_room",
        "container_theater_room",
        "hunting_cabin",
        "short_term_rental",
        "other",
      ],
      proposal_status: [
        "draft",
        "ready",
        "sent",
        "approved",
        "rejected",
        "expired",
      ],
    },
  },
} as const
