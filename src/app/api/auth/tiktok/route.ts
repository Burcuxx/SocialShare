import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, createPkce } from "@/lib/tiktok";

// GET /api/auth/tiktok?accountId=1 -> TikTok consent screen
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const state = `${accountId}.${randomUUID()}`;
  const { verifier, challenge } = createPkce();
  const res = NextResponse.redirect(authUrl(state, challenge));
  const cookie = { httpOnly: true, sameSite: "lax" as const, maxAge: 600 };
  res.cookies.set("oauth_state", state, cookie);
  res.cookies.set("tiktok_verifier", verifier, cookie);
  return res;
}
