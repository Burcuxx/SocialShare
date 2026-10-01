import { NextResponse, type NextRequest } from "next/server";
import { ownAccount, requireUser } from "@/lib/auth";
import { resumeJobs } from "@/lib/reconnect";
import { connect } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const accountId = Number(state?.split(".")[0]);
  const home = new URL(accountId ? `/accounts/${accountId}` : "/", process.env.APP_URL);

  if (!code || !state || !ownAccount(user.id, accountId) || state !== request.cookies.get("oauth_state")?.value) {
    home.searchParams.set("error", params.get("error") ?? "OAuth state mismatch");
    return NextResponse.redirect(home);
  }

  try {
    await connect(accountId, code);
    resumeJobs(accountId, "youtube");
  } catch (e) {
    home.searchParams.set("error", (e as Error).message);
  }
  const res = NextResponse.redirect(home);
  res.cookies.delete("oauth_state");
  return res;
}
