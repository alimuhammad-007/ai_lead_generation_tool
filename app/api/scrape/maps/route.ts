import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// ── Types ──────────────────────────────────────────────────────────────────────

interface SerperMapsPlace {
  title:        string;
  phoneNumber?: string;
  website?:     string;
  address?:     string;
  rating?:      number;
  cid?:         string;
}

interface SerperMapsResponse {
  places?: SerperMapsPlace[];
}

export interface MapsLead {
  name:    string;
  phone:   string | null;
  website: string | null;
  address: string | null;
  rating:  number | null;
  cid:     string | null;
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SERPER_API_KEY must be configured" },
      { status: 500 }
    );
  }

  let body: { businessType?: string; location?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { businessType, location, limit = 10 } = body;

  if (!businessType?.trim()) {
    return NextResponse.json({ error: "businessType is required" }, { status: 400 });
  }
  if (!location?.trim()) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  const fetchLimit = Math.min(Math.max(1, Number(limit) || 10), 50);
  const query = `${businessType.trim()} in ${location.trim()}`;

  let res: Response;
  try {
    res = await fetch("https://google.serper.dev/maps", {
      method:  "POST",
      headers: {
        "X-API-KEY":    apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: fetchLimit }),
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach Serper API" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Serper Maps API error: ${res.status}` },
      { status: 502 }
    );
  }

  const data = await res.json() as SerperMapsResponse;
  const places = (data.places ?? []).slice(0, fetchLimit);

  const leads: MapsLead[] = places.map((p) => ({
    name:    p.title,
    phone:   p.phoneNumber ?? null,
    website: p.website     ?? null,
    address: p.address     ?? null,
    rating:  p.rating      ?? null,
    cid:     p.cid         ?? null,
  }));

  return NextResponse.json({ leads, total: leads.length });
}
