import { NextRequest, NextResponse } from "next/server";
import { makeOAuthUrl } from "@/lib/server/google-drive";
import { apiError, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireNavyUser(request, "integrations.manage");
    return NextResponse.json({ url: makeOAuthUrl(user.uid, user.clinicId) });
  } catch (error) { return apiError(error); }
}
