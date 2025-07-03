import { NextResponse } from "next/server";
import { getAllCountries } from "@/server/db/company/queries";

export async function GET() {
  try {
    const countries = await getAllCountries();

    return NextResponse.json(countries);
  } catch (error) {
    console.error("Countries API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch countries" },
      { status: 500 },
    );
  }
}
