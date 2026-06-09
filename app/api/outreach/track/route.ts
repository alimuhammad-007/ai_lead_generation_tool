import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

// 1×1 transparent GIF — 43 bytes, standard tracking pixel
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const NO_CACHE_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get("id");

  if (trackingId) {
    const supabase = createAdminClient();

    // Transition sent → opened only once; ignore already-opened/replied rows
    const { error } = await supabase
      .from("outreach_emails")
      .update({
        status: "opened",
        opened_at: new Date().toISOString(),
      })
      .eq("tracking_id", trackingId)
      .eq("status", "sent");

    if (error) {
      console.error("[outreach/track] DB update error:", error.message);
    }
  }

  // Always return the pixel — never 404 or 500 (would break email rendering)
  return new NextResponse(PIXEL_GIF, { status: 200, headers: NO_CACHE_HEADERS });
}
