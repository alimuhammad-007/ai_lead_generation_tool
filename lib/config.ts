export const CLIENT_CONFIG = {
  companyName:    "Apex Lead Gen",
  companyTagline: "AI-Powered Lead Generation",
  primaryColor:   "#6366f1",
  logoLetter:     "A",
  industry:       "general",
  currency:       "USD",

  pricingPlans: {
    starter: {
      name:  "Starter",
      price: 299,
      type:  "one-time" as const,
      features: [
        "Up to 500 leads",
        "AI lead scoring",
        "Email outreach",
        "CSV import",
        "Email support",
      ],
    },
    pro: {
      name:  "Pro",
      price: 499,
      type:  "one-time" as const,
      features: [
        "Unlimited leads",
        "Advanced AI scoring",
        "Email sequences",
        "Multi-client management",
        "White-label branding",
        "Priority support",
      ],
    },
  },

  supportEmail: "support@apexleadgen.com",
} as const;

export type PricingPlanKey = keyof typeof CLIENT_CONFIG.pricingPlans;
