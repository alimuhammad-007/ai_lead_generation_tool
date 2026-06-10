export const CLIENT_CONFIG = {
  companyName:    "Apex Lead Gen",
  companyTagline: "AI-Powered Lead Generation",
  primaryColor:   "#6366f1",
  logoLetter:     "A",
  industry:       "general",
  supportEmail:   "support@apexleadgen.com",
  calendlyLink:   "https://calendly.com/your-link",

  // ── ICP Criteria ────────────────────────────────────────────────────────────
  icpCriteria: {
    targetIndustries: ["SaaS", "Tech", "Real Estate", "Healthcare"],
    targetTitles:     ["CEO", "Founder", "CTO", "Director", "Manager"],
    targetCompanySize: "1-200",
    targetLocation:    "any",
  },

  // ── Pricing tiers (used by proposal generator) ──────────────────────────────
  pricingTiers: [
    {
      name:    "Starter",
      price:   "$997/mo",
      features: [
        "Up to 500 AI-scored leads/month",
        "Automated email outreach (3-step sequence)",
        "Google Maps + LinkedIn prospecting",
        "Basic CRM export (CSV)",
        "Email support",
      ],
    },
    {
      name:    "Growth",
      price:   "$2,497/mo",
      features: [
        "Up to 2,000 AI-scored leads/month",
        "Full follow-up sequence automation (14-day)",
        "Lead research & company intelligence",
        "ICP matching & prioritization",
        "CRM integration (HubSpot, Salesforce)",
        "Priority support",
      ],
    },
    {
      name:    "Enterprise",
      price:   "Custom",
      features: [
        "Unlimited leads & sequences",
        "Custom AI models & ICP tuning",
        "White-label dashboard",
        "Dedicated account manager",
        "SLA & custom integrations",
      ],
    },
  ],
} as const;
