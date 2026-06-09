export type LeadStatus = "hot" | "warm" | "cold" | "unscored";

export type Lead = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  score: number;
  score_reason: string | null;
  status: LeadStatus;
  client_id: string | null;
  created_at: string;
};

export type OutreachEmailStatus = "scheduled" | "sent" | "opened" | "replied" | "failed";

export type OutreachCampaign = {
  id: string;
  name: string;
  created_at: string;
};

export type OutreachEmail = {
  id: string;
  user_id: string;
  lead_id: string;
  campaign_id: string | null;
  sequence_day: 1 | 3 | 7 | null;
  subject: string;
  body: string;
  html: string;
  status: OutreachEmailStatus;
  tracking_id: string;
  scheduled_for: string;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
};

export type ClientPlan = "free" | "starter" | "pro";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export type Client = {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: ClientPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: Lead;
        Insert: Omit<Lead, "id" | "created_at" | "score_reason" | "client_id"> & {
          score_reason?: string | null;
          client_id?: string | null;
          email?: string | null;
        };
        Update: Partial<Omit<Lead, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "stripe_customer_id" | "stripe_subscription_id"> & {
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
        Update: Partial<Omit<Client, "id" | "created_at">>;
        Relationships: [];
      };
      outreach_campaigns: {
        Row: OutreachCampaign;
        Insert: Omit<OutreachCampaign, "id" | "created_at">;
        Update: Partial<Omit<OutreachCampaign, "id" | "created_at">>;
        Relationships: [];
      };
      outreach_emails: {
        Row: OutreachEmail;
        Insert: Omit<OutreachEmail, "id" | "created_at" | "sent_at" | "opened_at"> & {
          id?: string;
          created_at?: string;
          sent_at?: string | null;
          opened_at?: string | null;
        };
        Update: Partial<Omit<OutreachEmail, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "outreach_emails_lead_id_fkey";
            columns: ["lead_id"];
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_emails_campaign_id_fkey";
            columns: ["campaign_id"];
            referencedRelation: "outreach_campaigns";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      lead_status: LeadStatus;
      outreach_email_status: OutreachEmailStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
