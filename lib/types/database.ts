// Database types — handcrafted to match supabase/migrations/0001_initial.sql.
// Regenerate with `supabase gen types typescript` once the CLI is wired up.

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ name: string; slug: string }>;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
        Update: Partial<{ role: "owner" | "admin" | "member" }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          display_name: string | null;
          avatar_url: string | null;
        }>;
        Relationships: [];
      };

      projects: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          team_name: string | null;
          idea_title: string | null;
          status: "active" | "paused" | "completed" | "archived";
          progress_pct: number;
          streak_days: number;
          badges: string[];
          started_at: string | null;
          due_at: string | null;
          theme_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          team_name?: string | null;
          idea_title?: string | null;
          status?: "active" | "paused" | "completed" | "archived";
          progress_pct?: number;
          streak_days?: number;
          badges?: string[];
          started_at?: string | null;
          due_at?: string | null;
          theme_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };

      themes: {
        Row: {
          id: string;
          organization_id: string;
          code: string | null;
          category: "new" | "renewal" | null;
          title: string;
          background: string | null;
          who_target: string | null;
          pain: string | null;
          what_uniqueness: string | null;
          what_benefit: string | null;
          how_hypothesis: string | null;
          expected_outcome: string | null;
          internal_challenges: string | null;
          theme_candidates: string | null;
          implementation_level: "poc" | "impl" | null;
          resource_people: string | null;
          resource_place: string | null;
          resource_budget: string | null;
          resource_data: string | null;
          resource_other: string | null;
          post_action: string | null;
          criteria_region: boolean;
          criteria_means: boolean;
          criteria_youth: boolean;
          company_name: string | null;
          contact_name: string | null;
          status: "draft" | "active" | "closed" | "archived";
          deadline: string | null;
          prize: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          [k: string]: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["themes"]["Row"]>;
        Relationships: [];
      };

      execution_plans: {
        Row: {
          id: string;
          project_id: string;
          why: string;
          who: string;
          what: string;
          how: string;
          product: string;
          price: string;
          place: string;
          promotion: string;
          qualitative_goal: string;
          scores: Json | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          why?: string;
          who?: string;
          what?: string;
          how?: string;
          product?: string;
          price?: string;
          place?: string;
          promotion?: string;
          qualitative_goal?: string;
          scores?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["execution_plans"]["Insert"]>;
        Relationships: [];
      };

      kpis: {
        Row: {
          id: string;
          plan_id: string;
          label: string;
          target: string | null;
          progress: number;
          due_date: string | null;
          unit: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          label: string;
          target?: string | null;
          progress?: number;
          due_date?: string | null;
          unit?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["kpis"]["Insert"]>;
        Relationships: [];
      };

      milestones: {
        Row: {
          id: string;
          project_id: string;
          label: string;
          date: string | null;
          done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          label: string;
          date?: string | null;
          done?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["milestones"]["Insert"]>;
        Relationships: [];
      };

      tasks: {
        Row: {
          id: string;
          project_id: string;
          parent_id: string | null;
          title: string;
          owner_name: string | null;
          start_week: number | null;
          span_week: number | null;
          progress: number;
          status: "todo" | "doing" | "review" | "done";
          is_milestone: boolean;
          tag: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          parent_id?: string | null;
          title: string;
          owner_name?: string | null;
          start_week?: number | null;
          span_week?: number | null;
          progress?: number;
          status?: "todo" | "doing" | "review" | "done";
          is_milestone?: boolean;
          tag?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };

      budget_items: {
        Row: {
          id: string;
          project_id: string;
          kind: "income" | "expense";
          category: string | null;
          name: string;
          plan_jpy: number;
          actual_jpy: number;
          is_pending: boolean;
          month: number | null;
          monthly_amounts: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          kind: "income" | "expense";
          name: string;
          [k: string]: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["budget_items"]["Insert"]>;
        Relationships: [];
      };

      diagnosis_entries: {
        Row: {
          id: string;
          project_id: string;
          week_start: string;
          scores: Json;
          total_comment: string | null;
          item_comments: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          week_start: string;
          scores?: Json;
          total_comment?: string | null;
          item_comments?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["diagnosis_entries"]["Insert"]>;
        Relationships: [];
      };

      fund_applications: {
        Row: {
          id: string;
          project_id: string;
          round: number;
          status: "draft" | "firstReview" | "secondReview" | "approved" | "rejected";
          amount_jpy: number;
          reason: string | null;
          purposes: Json | null;
          attachments: string[] | null;
          submitted_at: string | null;
          decided_at: string | null;
          ai_hints: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          round?: number;
          status?: "draft" | "firstReview" | "secondReview" | "approved" | "rejected";
          amount_jpy?: number;
          [k: string]: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["fund_applications"]["Insert"]>;
        Relationships: [];
      };

      events: {
        Row: {
          id: string;
          project_id: string;
          date: string | null;
          time: string | null;
          label: string;
          kind: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          label: string;
          [k: string]: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };

      proposals: {
        Row: {
          id: string;
          project_id: string;
          kind:
            | "execution_plan"
            | "wbs"
            | "budget"
            | "promo"
            | "application"
            | "theme"
            | "diagnosis";
          status: "pending" | "approved" | "rejected";
          summary: string;
          diff: Json;
          reasoning: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          kind: Database["public"]["Tables"]["proposals"]["Row"]["kind"];
          summary: string;
          diff: Json;
          [k: string]: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["proposals"]["Insert"]>;
        Relationships: [];
      };

      chat_messages: {
        Row: {
          id: string;
          project_id: string;
          role: "user" | "assistant" | "system";
          content: string | null;
          raw_content: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          role: "user" | "assistant" | "system";
          [k: string]: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };

      field_history: {
        Row: {
          id: string;
          project_id: string;
          table_name: string;
          field_name: string;
          value: string | null;
          changed_by: string;
          changed_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          table_name: string;
          field_name: string;
          [k: string]: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["field_history"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
