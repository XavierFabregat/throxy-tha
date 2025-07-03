import { db } from "@/server/db";
import { companies, type Company, type NewCompany } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { findByDomain, findByName } from "./queries";
import type { EnrichmentResult } from "@/lib/types";

export async function createCompany(company: NewCompany): Promise<Company> {
  const [created] = await db.insert(companies).values(company).returning();
  return created!;
}

export async function createCompanies(
  companiesData: NewCompany[],
): Promise<Company[]> {
  if (companiesData.length === 0) return [];

  const created = await db.insert(companies).values(companiesData).returning();
  return created;
}

export async function upsertCompany(
  company: NewCompany,
): Promise<{ company: Company; wasUpdated: boolean }> {
  // Check if company exists by domain or name
  let existing = null;

  if (company.domain) {
    existing = await findByDomain(company.domain);
  }

  if (!existing && company.name) {
    existing = await findByName(company.name);
  }

  if (existing) {
    // Update existing company
    const [updated] = await db
      .update(companies)
      .set({
        ...company,
        updated_at: new Date(),
      })
      .where(eq(companies.id, existing.id))
      .returning();

    return { company: updated!, wasUpdated: true };
  } else {
    // Create new company
    const created = await createCompany(company);
    return { company: created, wasUpdated: false };
  }
}

export async function updateCompanyEnrichment(
  companyId: string,
  enrichmentData: object,
): Promise<Company> {
  const [updated] = await db
    .update(companies)
    .set({
      enrichment_data: enrichmentData as EnrichmentResult,
      enriched_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(companies.id, companyId))
    .returning();

  if (!updated) {
    throw new Error(`Company with id ${companyId} not found`);
  }

  return updated;
}

// for testing purposes
export async function deleteAllCompanies() {
  // valid overwrite sine its the behavior we want
  // eslint-disable-next-line drizzle/enforce-delete-with-where
  await db.delete(companies);
}
