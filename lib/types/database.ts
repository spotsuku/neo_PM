// Database types — generate with `supabase gen types typescript` after schema is applied.
// For now we declare a permissive shape; expand as features are wired up.

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          slug: string;
        }>;
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
        Update: Partial<{
          role: "owner" | "admin" | "member";
        }>;
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
      };
    };
  };
};
