// Database types — handcrafted to match supabase/migrations/0001_initial.sql.
// Regenerate with `supabase gen types typescript` once the CLI is wired up.

export type Json =
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
          description: string | null;
          emoji: string | null;
          icon_url: string | null;
          icon_zoom: number;
          icon_offset_x: number;
          icon_offset_y: number;
          default_milestones: Json | null;
          competition_enabled: boolean;
          hide_free_tier_banner: boolean;
          fundraising_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          emoji?: string | null;
          icon_url?: string | null;
          icon_zoom?: number;
          icon_offset_x?: number;
          icon_offset_y?: number;
          default_milestones?: Json | null;
          competition_enabled?: boolean;
          hide_free_tier_banner?: boolean;
          fundraising_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          name: string;
          slug: string;
          description: string | null;
          emoji: string | null;
          icon_url: string | null;
          icon_zoom: number;
          icon_offset_x: number;
          icon_offset_y: number;
          default_milestones: Json | null;
          competition_enabled: boolean;
          hide_free_tier_banner: boolean;
          fundraising_enabled: boolean;
        }>;
        Relationships: [];
      };
      cap_tables: {
        Row: {
          project_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          data?: Json;
          updated_at?: string;
        };
        Update: Partial<{
          data: Json;
          updated_at: string;
        }>;
        Relationships: [];
      };
      breakeven_plans: {
        Row: {
          project_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          data?: Json;
          updated_at?: string;
        };
        Update: Partial<{
          data: Json;
          updated_at: string;
        }>;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: "owner" | "admin" | "member" | "theme_owner";
          affiliation: string | null;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role?: "owner" | "admin" | "member" | "theme_owner";
          affiliation?: string | null;
          title?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          role: "owner" | "admin" | "member" | "theme_owner";
          affiliation: string | null;
          title: string | null;
        }>;
        Relationships: [];
      };
      project_memberships: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: "lead" | "member";
          title: string | null;
          responsibility: string | null;
          work_description: string | null;
          is_budget_approver: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: "lead" | "member";
          title?: string | null;
          responsibility?: string | null;
          work_description?: string | null;
          is_budget_approver?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          role: "lead" | "member";
          title: string | null;
          responsibility: string | null;
          work_description: string | null;
          is_budget_approver: boolean;
        }>;
        Relationships: [];
      };

      project_posts: {
        Row: {
          id: string;
          project_id: string;
          author_user_id: string;
          content: string;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          author_user_id: string;
          content: string;
          image_url?: string | null;
        };
        Update: Partial<{
          content: string;
          image_url: string | null;
        }>;
        Relationships: [];
      };

      project_post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: Partial<Record<string, never>>;
        Relationships: [];
      };

      project_post_comments: {
        Row: {
          id: string;
          post_id: string;
          author_user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_user_id: string;
          content: string;
        };
        Update: Partial<{ content: string }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          title: string | null;
          catchphrase: string | null;
          bio: string | null;
          tutorial_completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          title?: string | null;
          catchphrase?: string | null;
          bio?: string | null;
          tutorial_completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          display_name: string | null;
          avatar_url: string | null;
          title: string | null;
          catchphrase: string | null;
          bio: string | null;
          tutorial_completed_at: string | null;
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
          thumbnail_url: string | null;
          is_demo: boolean;
          visibility: "private" | "submitted" | "published";
          publish_submitted_at: string | null;
          publish_reviewed_at: string | null;
          publish_reviewed_by: string | null;
          publish_note: string | null;
          publish_app: Json | null;
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
          thumbnail_url?: string | null;
          is_demo?: boolean;
          due_at?: string | null;
          theme_id?: string | null;
          visibility?: "private" | "submitted" | "published";
          publish_submitted_at?: string | null;
          publish_reviewed_at?: string | null;
          publish_reviewed_by?: string | null;
          publish_note?: string | null;
          publish_app?: Json | null;
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
          vision: string | null;
          current_state: string | null;
          root_cause: string | null;
          focus_issue: string | null;
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
          status:
            | "draft"
            | "submitted"
            | "changes_requested"
            | "active"
            | "closed"
            | "archived";
          deadline: string | null;
          prize: string | null;
          thumbnail_url: string | null;
          thumbnail_zoom: number | null;
          thumbnail_offset_x: number | null;
          thumbnail_offset_y: number | null;
          description_long: string | null;
          posted_by: string | null;
          submitted_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_note: string | null;
          ai_scores: Json | null;
          ai_scored_at: string | null;
          is_demo: boolean;
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

      theme_collaborators: {
        Row: {
          id: string;
          theme_id: string;
          user_id: string;
          role: "editor" | "viewer";
          added_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          theme_id: string;
          user_id: string;
          role: "editor" | "viewer";
          added_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          role: "editor" | "viewer";
        }>;
        Relationships: [];
      };

      content_snapshots: {
        Row: {
          id: string;
          target_type: "theme" | "project";
          target_id: string;
          snapshot: Json;
          taken_at: string;
          taken_by: string | null;
          source: "autosave" | "manual" | "before_restore";
        };
        Insert: {
          id?: string;
          target_type: "theme" | "project";
          target_id: string;
          snapshot: Json;
          taken_at?: string;
          taken_by?: string | null;
          source?: "autosave" | "manual" | "before_restore";
        };
        Update: Partial<Record<string, never>>;
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
          last_observation: string | null;
          last_observation_values_key: string | null;
          last_observed_at: string | null;
          schedule: string | null;
          budget_plan: string | null;
          idea_summary: string | null;
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
          last_observation?: string | null;
          last_observation_values_key?: string | null;
          last_observed_at?: string | null;
          schedule?: string | null;
          budget_plan?: string | null;
          idea_summary?: string | null;
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
          assignee_user_id: string | null;
          assignee_email: string | null;
          start_week: number | null;
          span_week: number | null;
          start_date: string | null;
          end_date: string | null;
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
          assignee_user_id?: string | null;
          start_week?: number | null;
          span_week?: number | null;
          start_date?: string | null;
          end_date?: string | null;
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
          kind: "income" | "cogs" | "sga" | "expense";
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
          kind: "income" | "cogs" | "sga" | "expense";
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
          user_id: string | null;
          entry_date: string;
          week_start: string | null;
          scores: Json;
          total_comment: string | null;
          item_comments: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id?: string | null;
          entry_date?: string;
          week_start?: string | null;
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

      meeting_recurrences: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          interval: "weekly" | "biweekly" | "monthly";
          day_of_week: number | null;
          day_of_month: number | null;
          start_time: string;
          duration_min: number;
          location: string | null;
          agenda_template: string | null;
          starts_on: string;
          ends_on: string | null;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          interval: "weekly" | "biweekly" | "monthly";
          day_of_week?: number | null;
          day_of_month?: number | null;
          start_time: string;
          duration_min?: number;
          location?: string | null;
          agenda_template?: string | null;
          starts_on?: string;
          ends_on?: string | null;
          active?: boolean;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["meeting_recurrences"]["Insert"]
        >;
        Relationships: [];
      };

      meetings: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          scheduled_at: string | null;
          duration_min: number;
          location: string | null;
          status: "scheduled" | "in_progress" | "finished" | "cancelled";
          agenda: string | null;
          minutes: string | null;
          decisions: string | null;
          notion_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          scheduled_at?: string | null;
          duration_min?: number;
          location?: string | null;
          status?: "scheduled" | "in_progress" | "finished" | "cancelled";
          agenda?: string | null;
          minutes?: string | null;
          decisions?: string | null;
          notion_url?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meetings"]["Insert"]>;
        Relationships: [];
      };

      meeting_participants: {
        Row: {
          id: string;
          meeting_id: string;
          user_id: string;
          attended: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          user_id: string;
          attended?: boolean;
        };
        Update: Partial<{ attended: boolean }>;
        Relationships: [];
      };

      action_items: {
        Row: {
          id: string;
          project_id: string;
          meeting_id: string | null;
          title: string;
          detail: string | null;
          assignee_user_id: string | null;
          assignee_name: string | null;
          due_date: string | null;
          status: "open" | "in_progress" | "done" | "cancelled";
          source: "manual" | "ai_extracted" | "imported";
          source_task_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          meeting_id?: string | null;
          title: string;
          detail?: string | null;
          assignee_user_id?: string | null;
          assignee_name?: string | null;
          due_date?: string | null;
          status?: "open" | "in_progress" | "done" | "cancelled";
          source?: "manual" | "ai_extracted" | "imported";
          source_task_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["action_items"]["Insert"]>;
        Relationships: [];
      };

      review_decisions: {
        Row: {
          id: string;
          target_type: "project" | "theme";
          target_id: string;
          item_key: string;
          decision: "approved" | "changes_requested";
          comment: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          target_type: "project" | "theme";
          target_id: string;
          item_key: string;
          decision: "approved" | "changes_requested";
          comment?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["review_decisions"]["Insert"]
        >;
        Relationships: [];
      };
      quests: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string | null;
          title: string;
          description: string | null;
          emoji: string | null;
          starts_at: string;
          ends_at: string;
          status: "active" | "paused" | "archived";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          emoji?: string | null;
          starts_at?: string;
          ends_at: string;
          status?: "active" | "paused" | "archived";
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quests"]["Insert"]>;
        Relationships: [];
      };

      quest_items: {
        Row: {
          id: string;
          quest_id: string;
          label: string;
          position: number;
          target_count: number;
          done_count: number;
          auto_target:
            | "manual"
            | "tasks_done"
            | "plan_filled"
            | "diag_filled"
            | "meetings_held"
            | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quest_id: string;
          label: string;
          position?: number;
          target_count?: number;
          done_count?: number;
          auto_target?:
            | "manual"
            | "tasks_done"
            | "plan_filled"
            | "diag_filled"
            | "meetings_held"
            | null;
        };
        Update: Partial<Database["public"]["Tables"]["quest_items"]["Insert"]>;
        Relationships: [];
      };

      badges: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          emoji: string | null;
          color: string | null;
          description: string | null;
          criteria_text: string | null;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          emoji?: string | null;
          color?: string | null;
          description?: string | null;
          criteria_text?: string | null;
          position?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["badges"]["Insert"]>;
        Relationships: [];
      };

      badge_awards: {
        Row: {
          id: string;
          badge_id: string;
          project_id: string;
          awarded_by: string | null;
          awarded_at: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          badge_id: string;
          project_id: string;
          awarded_by?: string | null;
          awarded_at?: string;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["badge_awards"]["Insert"]>;
        Relationships: [];
      };

      theme_applications: {
        Row: {
          id: string;
          theme_id: string;
          applicant_user_id: string;
          applicant_org_id: string | null;
          team_name: string;
          proposal: string | null;
          members: string | null;
          proposal_summary: string | null;
          plan_why: string | null;
          plan_who: string | null;
          plan_what: string | null;
          plan_how: string | null;
          plan_where: string | null;
          schedule: string | null;
          budget_plan: string | null;
          status:
            | "draft"
            | "submitted"
            | "under_review"
            | "approved"
            | "rejected"
            | "withdrawn";
          submitted_at: string | null;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          created_project_id: string | null;
          project_started_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          theme_id: string;
          applicant_user_id: string;
          applicant_org_id?: string | null;
          team_name?: string;
          proposal?: string | null;
          members?: string | null;
          proposal_summary?: string | null;
          plan_why?: string | null;
          plan_who?: string | null;
          plan_what?: string | null;
          plan_how?: string | null;
          plan_where?: string | null;
          schedule?: string | null;
          budget_plan?: string | null;
          status?:
            | "draft"
            | "submitted"
            | "under_review"
            | "approved"
            | "rejected"
            | "withdrawn";
          submitted_at?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          created_project_id?: string | null;
          project_started_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["theme_applications"]["Insert"]>;
        Relationships: [];
      };

      invitations: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          token: string;
          role: "admin" | "member" | "theme_owner";
          note: string | null;
          expires_at: string | null;
          used_at: string | null;
          used_by: string | null;
          target_project_id: string | null;
          target_project_role: "lead" | "member" | null;
          intended_email: string | null;
          intended_name: string | null;
          intended_affiliation: string | null;
          intended_title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          token?: string;
          role?: "admin" | "member" | "theme_owner";
          note?: string | null;
          expires_at?: string | null;
          target_project_id?: string | null;
          target_project_role?: "lead" | "member" | null;
          intended_email?: string | null;
          intended_name?: string | null;
          intended_affiliation?: string | null;
          intended_title?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      accessible_project_ids: {
        Args: { p_org_id: string };
        Returns: { id: string }[];
      };
      can_access_project: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      can_manage_project: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      create_project_with_lead: {
        Args: {
          p_org: string;
          p_name: string;
          p_team?: string | null;
          p_idea?: string | null;
          p_theme?: string | null;
          p_started?: string | null;
          p_due?: string | null;
        };
        Returns: string;
      };
      project_dashboard_score_inputs: {
        Args: { p_project_id: string };
        Returns: Json;
      };
      delete_organization: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      redeem_invitation: {
        Args: { p_token: string };
        Returns: {
          org_id: string;
          org_slug: string;
          org_name: string;
          project_id: string | null;
        }[];
      };
      peek_invitation: {
        Args: { p_token: string };
        Returns: {
          org_name: string;
          role: "admin" | "member" | "theme_owner";
          expired: boolean;
          used: boolean;
          project_name: string | null;
          project_role: "lead" | "member" | null;
          intended_email: string | null;
          intended_name: string | null;
        }[];
      };
      transfer_theme_owner: {
        Args: { p_theme_id: string; p_new_user_id: string };
        Returns: void;
      };
      snapshot_theme: {
        Args: { p_theme_id: string; p_source?: string };
        Returns: string | null;
      };
      restore_theme_snapshot: {
        Args: { p_snapshot_id: string };
        Returns: void;
      };
      snapshot_project: {
        Args: { p_project_id: string; p_source?: string };
        Returns: string | null;
      };
      restore_project_snapshot: {
        Args: { p_snapshot_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
