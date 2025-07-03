export interface UploadResult {
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetails: string[];
  totalCost?: number;
}
