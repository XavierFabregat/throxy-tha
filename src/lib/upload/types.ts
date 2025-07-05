import type { Company } from "../../server/db/schema";

export interface UploadResult {
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetails: string[];
  totalCost?: number;
  companies: Company[];
  // Enrichment tracking
  enriched: number;
  enrichmentErrors: number;
  enrichmentSkipped: number;
}
