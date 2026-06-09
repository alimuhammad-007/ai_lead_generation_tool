import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase";

// ── Plan config ───────────────────────────────────────────────────────────────
//
// Set STRIPE_STARTER_PRICE_ID and STRIPE_PRO_PRICE_ID in .env.local
// to use pre-created Stripe prices. If the env vars are absent, the route
// creates prices inline using price_data (useful for first-time setup).

const PLANS = {
  starter: {
    label:   "Apex Lead Gen — Starter",
    amount:  29_900,  // $299.00 in USD cents
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  pro: {
    label:   "Apex Lead Gen — Pro",
    amount:  49_900,  // $499.00 in USD cents
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
} as const;

type PlanKey = keyof typeof PLANS;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Body: { action: "create_checkout" | "portal", client_id, plan? }

export async function POST(req: NextRequest) {
  let body: { action?: string; client_id?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, client_id, plan } = body;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured — set STRIPE_SECRET_KEY in .env.local" },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── create_checkout ──────────────────────────────────────────────────────
  if (action === "create_checkout") {
    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }
    if (!plan || !(plan in PLANS)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${Object.keys(PLANS).join(", ")}` },
        { status: 400 }
      );
    }

    const planCfg = PLANS[plan as PlanKey];

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, email, company, stripe_customer_id")
      .eq("id", client_id)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = client.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: `${client.name} (${client.company})`,
        email: client.email,
        metadata: { client_id, company: client.company },
      });
      customerId = customer.id;
      await supabase
        .from("clients")
        .update({ stripe_customer_id: customerId })
        .eq("id", client_id);
    }

    // Build line item — prefer pre-configured price ID, fall back to price_data
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = planCfg.priceId
      ? { price: planCfg.priceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: { name: planCfg.label },
            unit_amount: planCfg.amount,
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      customer:    customerId,
      mode:        "payment",
      line_items:  [lineItem],
      success_url: `${appUrl}/clients?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/clients?checkout=canceled`,
      metadata:    { client_id, plan },
    });

    return NextResponse.json({ url: session.url });
  }

  // ── portal ───────────────────────────────────────────────────────────────
  if (action === "portal") {
    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("stripe_customer_id")
      .eq("id", client_id)
      .single();

    if (clientErr || !client?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for this client — subscribe first" },
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   client.stripe_customer_id,
      return_url: `${appUrl}/clients`,
    });

    return NextResponse.json({ url: session.url });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// ── GET — subscription status for a client ────────────────────────────────────

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ error: "client_id query param required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, plan, subscription_status, stripe_customer_id")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({
    plan:              client.plan,
    status:            client.subscription_status,
    has_stripe:        !!client.stripe_customer_id,
    plans_available:   Object.entries(PLANS).map(([key, cfg]) => ({
      key,
      label: cfg.label,
      amount_usd: cfg.amount / 100,
    })),
  });
}
