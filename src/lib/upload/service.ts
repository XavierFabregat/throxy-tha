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
      console.log("🔍 Starting CSV processing...");
      const rows = this.parseCSV(csvData);
      console.log(`📊 Parsed ${rows.length} rows from CSV`);

      if (rows.length > 0) {
        console.log("📋 First row sample:", JSON.stringify(rows[0], null, 2));
        console.log("🔑 Available keys:", Object.keys(rows[0] ?? {}));
      }

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
            console.log(
              `🔎 Processing row ${result.processed}:`,
              JSON.stringify(row, null, 2),
            );

            const validated = RawCompanySchema.parse(row);
            console.log(`✅ Row ${result.processed} validated successfully`);
            validatedRows.push(validated);
          } catch (error) {
            // if it fails here, the row is invalid and we should not try to clean it
            result.errors++;
            const errorMsg =
              error instanceof Error
                ? error.message
                : "Unknown validation error";
            console.error(
              `❌ Row ${result.processed} validation failed:`,
              errorMsg,
            );
            console.error(`📄 Row data was:`, JSON.stringify(row, null, 2));
            result.errorDetails.push(
              `Row ${result.processed}: Invalid data format - ${errorMsg}`,
            );
          }
        }
      }

      console.log(
        `🤖 Starting AI cleaning for ${validatedRows.length} validated rows...`,
      );
      const cleanedCompanies = await this.cleaner.cleanBatchData(validatedRows);

      if (!cleanedCompanies) {
        console.error("❌ AI cleaning completely failed");
        throw new Error("AI cleaning failed");
      }

      console.log(
        `🧹 AI cleaning completed. Got ${cleanedCompanies.data.length} results`,
      );

      // we save the cleaned companies to the database
      for (let i = 0; i < cleanedCompanies.data.length; i++) {
        const cleaned = cleanedCompanies.data[i];

        if (!cleaned) {
          result.errors++;
          console.error(`❌ Row ${i + 1}: AI cleaning returned null`);
          result.errorDetails.push(`Row ${i + 1}: AI cleaning failed`);
          continue;
        }

        console.log(`💾 Saving cleaned company ${i + 1}:`, {
          name: cleaned.name,
          domain: cleaned.domain,
          country: cleaned.country,
          employee_size: cleaned.employee_size,
        });

        try {
          // We upsert instead of insert since we don;t wnat dupliicated companies in our db, instead if we get another company in the db we want to update it
          const { wasUpdated } = await upsertCompany(cleaned);

          if (wasUpdated) {
            result.updated++;
            console.log(`✅ Updated existing company: ${cleaned.name}`);
          } else {
            result.inserted++;
            console.log(`✅ Inserted new company: ${cleaned.name}`);
          }
        } catch (error) {
          result.errors++;
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          console.error(`❌ Database error for ${cleaned.name}:`, errorMsg);
          result.errorDetails.push(
            `Row ${i + 1}: Database error - ${errorMsg}`,
          );
        }
      }
    } catch (error) {
      console.error("💥 CSV processing failed:", error);
      throw new Error(
        `CSV processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    console.log("📊 Final Results:", {
      processed: result.processed,
      inserted: result.inserted,
      updated: result.updated,
      errors: result.errors,
      errorCount: result.errorDetails.length,
    });

    if (result.errorDetails.length > 0) {
      console.log("❌ Error Details:", result.errorDetails);
    }

    return result;
  }

  private parseCSV(csvData: string): RawCompanyData[] {
    const lines = csvData.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error("CSV must have at least a header and one data row");
    }

    // Detect delimiter (tab vs comma)
    const delimiter = lines[0]!.includes("\t") ? "\t" : ",";

    // Parse headers
    const headers = this.parseCSVLine(lines[0]!, delimiter);

    // Parse data rows
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]!, delimiter);

      if (values.length === 0) continue; // Skip empty lines

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        // Normalize header names to match our schema
        const normalizedHeader = this.normalizeHeader(header);
        row[normalizedHeader] = values[index] ?? "";
      });

      rows.push(row);
    }

    return rows;
  }

  private normalizeHeader(header: string): string {
    const normalized = header.toLowerCase().trim();

    // Map various header names to our expected schema fields
    const headerMap: Record<string, string> = {
      company_name: "name",
      company: "name",
      name: "name",
      domain: "domain",
      website: "domain",
      url: "domain",
      country: "country",
      location: "country",
      employee_size: "employee_size",
      employees: "employee_size",
      size: "employee_size",
      headcount: "employee_size",
    };

    return headerMap[normalized] ?? normalized;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
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
