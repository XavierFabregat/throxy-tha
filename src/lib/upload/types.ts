export interface UploadResult {
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetails: string[];
  totalCost?: number;
  // Enrichment tracking
  enriched: number;
  enrichmentErrors: number;
  enrichmentSkipped: number;
}
