import { type NextRequest, NextResponse } from "next/server";
import { CompanyFiltersSchema } from "@/lib/types";
import { findWithFilters, countWithFilters } from "@/server/db/company/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = CompanyFiltersSchema.parse(
      Object.fromEntries(searchParams),
    );

    const [companies, total] = await Promise.all([
      findWithFilters(filters),
      countWithFilters({
        country: filters.country,
        employee_size: filters.employee_size,
        domain: filters.domain,
      }),
    ]);

    return NextResponse.json({
      companies,
      total,
      page: Math.floor(filters.offset / filters.limit) + 1,
      pageSize: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    });
  } catch (error) {
    console.error("Companies API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 },
    );
  }
}
