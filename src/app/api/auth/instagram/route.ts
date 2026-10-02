import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ownAccount, requireUser } from "@/lib/auth";
import { authUrl } from "@/lib/instagram";

// GET /api/auth/instagram?accountId=1 -> Facebook Login (Instagram permissions)
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId || !ownAccount(user.id, Number(accountId))) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const state = `${accountId}.${randomUUID()}`;
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600 });
  return res;
}
