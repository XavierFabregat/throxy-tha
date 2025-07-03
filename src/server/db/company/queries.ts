import { db } from "@/server/db";
import { companies, type Company } from "../schema";
import { eq, ilike, and, desc, count } from "drizzle-orm";
import type { CompanyFilters } from "@/lib/types";

export async function findByDomain(domain: string): Promise<Company | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.domain, domain))
    .limit(1);

  return company ?? null;
}

export async function findByName(name: string): Promise<Company | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.name, name))
    .limit(1);

  return company ?? null;
}

export async function findWithFilters(
  filters: CompanyFilters,
): Promise<Company[]> {
  const conditions = [];

  if (filters.country) {
    conditions.push(ilike(companies.country, `%${filters.country}%`));
  }

  if (filters.employee_size) {
    conditions.push(eq(companies.employee_size, filters.employee_size));
  }

  if (filters.domain) {
    conditions.push(ilike(companies.domain, `%${filters.domain}%`));
  }

  return await db
    .select()
    .from(companies)
    .where(and(...conditions))
    .orderBy(desc(companies.created_at))
    .limit(filters.limit)
    .offset(filters.offset);
}

export async function countWithFilters(
  filters: Omit<CompanyFilters, "limit" | "offset">,
): Promise<number> {
  const conditions = [];

  if (filters.country) {
    conditions.push(ilike(companies.country, `%${filters.country}%`));
  }

  if (filters.employee_size) {
    conditions.push(eq(companies.employee_size, filters.employee_size));
  }

  if (filters.domain) {
    conditions.push(ilike(companies.domain, `%${filters.domain}%`));
  }

  const [result] = await db
    .select({ count: count() })
    .from(companies)
    .where(and(...conditions));

  return result?.count ?? 0;
}

// For better UI experience, we can get all employee sizes and countries from the database
export async function getAllCountries(): Promise<string[]> {
  const result = await db
    .selectDistinct({ country: companies.country })
    .from(companies)
    .orderBy(companies.country);

  return result.map((r) => r.country);
}

export async function getAllEmployeeSizes(): Promise<string[]> {
  const result = await db
    .selectDistinct({ employee_size: companies.employee_size })
    .from(companies)
    .orderBy(companies.employee_size);

  return result.map((r) => r.employee_size);
}
