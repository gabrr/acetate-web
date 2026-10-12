import { NextRequest, NextResponse } from "next/server";
import { authorizedIdentity } from "@/auth/entry";
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] || "";
  try {
    const authorized = await authorizedIdentity(token);
    return NextResponse.json({}, { status: authorized ? 200 : 401, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({}, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
