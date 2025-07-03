import { CompanyDataAICleaner } from "@/lib/ai/cleaning";
import { upsertCompany } from "@/server/db/company/mutations";
import { RawCompanySchema, type RawCompanyData } from "@/lib/types";
import type { AIModelInterface } from "@/lib/ai/types";
import type { UploadResult } from "./types";

export class UploadService {
  private cleaner: CompanyDataAICleaner;

  constructor(aiModel: AIModelInterface) {
    this.cleaner = new CompanyDataAICleaner(aiModel);
  }

  async processCSV(csvData: string): Promise<UploadResult> {
    const result: UploadResult = {
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [],
      totalCost: 0,
    };

    try {
      const rows = this.parseCSV(csvData);

      if (rows.length === 0) {
        throw new Error("No valid data rows found in CSV");
      }

      // Validate and clean data in batches
      const batchSize = 10;
      const validatedRows: RawCompanyData[] = [];

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        for (const row of batch) {
          try {
            result.processed++;
            const validated = RawCompanySchema.parse(row);
            validatedRows.push(validated);
          } catch {
            // if it fails here, the row is invalid and we should not try to clean it
            result.errors++;
            result.errorDetails.push(
              `Row ${result.processed}: Invalid data format`,
            );
          }
        }
      }

      const cleanedCompanies = await this.cleaner.cleanBatchData(validatedRows);

      if (!cleanedCompanies) {
        throw new Error("AI cleaning failed");
      }

      // we save the cleaned companies to the database
      for (let i = 0; i < cleanedCompanies.data.length; i++) {
        const cleaned = cleanedCompanies.data[i];

        if (!cleaned) {
          result.errors++;
          result.errorDetails.push(`Row ${i + 1}: AI cleaning failed`);
          continue;
        }

        try {
          // We upsert instead of insert since we don;t wnat dupliicated companies in our db, instead if we get another company in the db we want to update it
          const { wasUpdated } = await upsertCompany(cleaned);

          if (wasUpdated) {
            result.updated++;
          } else {
            result.inserted++;
          }
        } catch (error) {
          result.errors++;
          result.errorDetails.push(
            `Row ${i + 1}: Database error - ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }
    } catch (error) {
      throw new Error(
        `CSV processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return result;
  }

  private parseCSV(csvData: string): RawCompanyData[] {
    const lines = csvData.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error("CSV must have at least a header and one data row");
    }

    // Parse headers
    const headers = this.parseCSVLine(lines[0]!);

    // Parse data rows
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]!);

      if (values.length === 0) continue; // Skip empty lines

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      rows.push(row);
    }

    return rows;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result.map((field) => field.replace(/^"|"$/g, "")); // Remove surrounding quotes
  }
}
