import { NextResponse, type NextRequest } from "next/server";
import { connect } from "@/lib/tiktok";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const verifier = request.cookies.get("tiktok_verifier")?.value;
  const accountId = Number(state?.split(".")[0]);
  const home = new URL(accountId ? `/accounts/${accountId}` : "/", process.env.APP_URL);

  if (!code || !state || !verifier || state !== request.cookies.get("oauth_state")?.value) {
    home.searchParams.set("error", params.get("error_description") ?? "OAuth state mismatch");
    return NextResponse.redirect(home);
  }

  try {
    await connect(accountId, code, verifier);
  } catch (e) {
    home.searchParams.set("error", (e as Error).message);
  }
  const res = NextResponse.redirect(home);
  res.cookies.delete("oauth_state");
  res.cookies.delete("tiktok_verifier");
  return res;
}
