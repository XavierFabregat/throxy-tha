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

  // First check by domain since its a true unique identifier
  // two companies can have the same name, but they can't have the same domain
  // since domain can be null, we need to check if it exists first
  if (company.domain) {
    existing = await findByDomain(company.domain);
  }

  // Only in the case there is no domain, (which would be rare in our approach)
  // we check by name
  // TODO: better apporach is to check by name/country combination since
  // two companies can have the same name, but not in the same country
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
