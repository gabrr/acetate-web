import { NextResponse } from "next/server";
import { entryConfig } from "@/auth/entry";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(entryConfig(), { headers: { "Cache-Control": "no-store" } });
}
