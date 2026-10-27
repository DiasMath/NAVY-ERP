import { NextRequest, NextResponse } from "next/server";
import { driveConfigured, driveStatus } from "@/lib/server/google-drive";
import { apiError, requireNavyUser } from "@/lib/server/navy-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireNavyUser(request, "integrations.read");
    const status = driveConfigured() ? await driveStatus(user.clinicId) : { connected: false };
    return NextResponse.json({ configured: driveConfigured(), ...status, canConnect: ["master_admin", "admin"].includes(user.role) });
  } catch (error) { return apiError(error); }
}
