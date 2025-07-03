import { type NextRequest, NextResponse } from "next/server";
import { CompanyFiltersSchema, type CompaniesResponse } from "@/lib/types";
import { findWithFilters, countWithFilters } from "@/server/db/company/queries";
import { deleteAllCompanies } from "../../../server/db/company/mutations";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<CompaniesResponse | { error: string }>> {
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
    });
  } catch (error) {
    console.error("Companies API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest) {
  await deleteAllCompanies();
  return NextResponse.json({ message: "All companies deleted" });
}
