import { NextResponse } from "next/server";
import { EMPLOYEE_SIZE_BUCKETS } from "@/lib/types";

export async function GET() {
  return NextResponse.json(EMPLOYEE_SIZE_BUCKETS);
}
