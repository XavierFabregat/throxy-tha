import { CompanyDataAICleaner } from "@/lib/ai/cleaning";
import {
  upsertCompany,
  updateCompanyEnrichment,
} from "@/server/db/company/mutations";
import { RawCompanySchema, type RawCompanyData } from "@/lib/types";
import type { AIModelInterface } from "@/lib/ai/types";
import type { UploadResult } from "./types";
import { CompanyEnrichmentService } from "@/lib/enrichment/service";
import type { NewsService } from "../enrichment/news/service";
import type { Company } from "../../server/db/schema";

export class UploadService {
  private cleaner: CompanyDataAICleaner;
  private enrichmentService?: CompanyEnrichmentService;

  constructor(
    aiModel: AIModelInterface,
    newsService: NewsService,
    enableEnrichment = false,
  ) {
    this.cleaner = new CompanyDataAICleaner(aiModel);

    if (enableEnrichment) {
      this.enrichmentService = new CompanyEnrichmentService(
        aiModel,
        newsService,
      );
    }
  }

  async processCSV(csvData: string): Promise<UploadResult> {
    const result: UploadResult = {
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [],
      totalCost: 0,
      enriched: 0,
      enrichmentErrors: 0,
      enrichmentSkipped: 0,
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
      // const cleanedCompanies = await this.cleaner.cleanBatchData(validatedRows);
      const cleanedCompanies = (
        await Promise.all(
          validatedRows.map((row) => this.cleaner.cleanData(row)),
        )
      ).filter((response) => response !== null);

      if (!cleanedCompanies) {
        console.error("❌ AI cleaning completely failed");
        throw new Error("AI cleaning failed");
      }

      console.log(
        `🧹 AI cleaning completed. Got ${cleanedCompanies.length} results`,
      );

      // PHASE 1: Save all cleaned companies to database first (to get IDs)
      console.log(
        `💾 Saving ${cleanedCompanies.length} companies to database...`,
      );
      const savedCompanies: Company[] = [];

      for (let i = 0; i < cleanedCompanies.length; i++) {
        const cleaned = cleanedCompanies[i]?.data;

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
          const { wasUpdated, company } = await upsertCompany(cleaned);

          if (wasUpdated) {
            result.updated++;
            console.log(`✅ Updated existing company: ${cleaned.name}`);
          } else {
            result.inserted++;
            console.log(`✅ Inserted new company: ${cleaned.name}`);
          }

          // Collect companies for potential enrichment
          if (company) {
            savedCompanies.push(company);
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

      // PHASE 2: Parallel enrichment of saved companies (if enabled)
      if (this.enrichmentService && savedCompanies.length > 0) {
        console.log(
          `🚀 Starting parallel enrichment for ${savedCompanies.length} companies...`,
        );

        // DESIGN DECISION: Parallel enrichment for massive speed improvement
        // Trade-off: Higher API burst costs vs 20x faster processing
        const enrichmentPromises = savedCompanies.map(
          async (company, index) => {
            try {
              console.log(
                `🔍 Enriching ${company.name}... (${index + 1}/${savedCompanies.length})`,
              );

              const enrichmentResult =
                await this.enrichmentService!.enrichCompany(company);

              // Save enrichment results to database
              await updateCompanyEnrichment(company.id, enrichmentResult);

              return {
                success: true,
                company: company.name,
                confidence: enrichmentResult.confidence_score,
              };
            } catch (enrichError) {
              return {
                success: false,
                company: company.name,
                error:
                  enrichError instanceof Error
                    ? enrichError.message
                    : "Unknown error",
              };
            }
          },
        );

        // Execute all enrichments in parallel using Promise.allSettled
        // DESIGN DECISION: allSettled vs all - individual failures shouldn't stop the batch
        const enrichmentResults = await Promise.allSettled(enrichmentPromises);

        // Process enrichment results
        for (const promiseResult of enrichmentResults) {
          if (promiseResult.status === "fulfilled") {
            const enrichResult = promiseResult.value;

            if (enrichResult.success) {
              result.enriched++;
              console.log(
                `✅ Enriched ${enrichResult.company} (confidence: ${enrichResult.confidence}%)`,
              );
            } else {
              result.enrichmentErrors++;
              console.warn(
                `⚠️ Enrichment failed for ${enrichResult.company}:`,
                enrichResult.error,
              );
              result.errorDetails.push(
                `Enrichment failed for ${enrichResult.company}: ${enrichResult.error}`,
              );
            }
          } else {
            // Shouldn't happen with our error handling, but safety net
            result.enrichmentErrors++;
            console.error(
              "Unexpected enrichment promise rejection:",
              promiseResult.reason,
            );
            result.errorDetails.push(
              `Unexpected enrichment error: ${promiseResult.reason}`,
            );
          }
        }

        console.log(
          `🎉 Parallel enrichment completed! ${result.enriched} succeeded, ${result.enrichmentErrors} failed`,
        );
      } else if (!this.enrichmentService) {
        result.enrichmentSkipped = savedCompanies.length;
        console.log(
          `⏭️ Enrichment skipped for ${savedCompanies.length} companies (feature disabled)`,
        );
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

    // This returns an array of objects, each object is a row in the csv
    // Each object has a key for each header, and the value is the value of the cell in the csv
    return rows;
  }

  private normalizeHeader(header: string): string {
    const normalized = header.toLowerCase().trim();

    // Map various header names to our expected schema fields
    const headerMap: Record<string, string> = {
      company_name: "name",
      domain: "domain",
      country: "country",
      employee_size: "employee_size",
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
