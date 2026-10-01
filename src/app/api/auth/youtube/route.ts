import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl } from "@/lib/youtube";

// GET /api/auth/youtube?accountId=1 -> Google consent screen
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const state = `${accountId}.${randomUUID()}`;
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600 });
  return res;
}
