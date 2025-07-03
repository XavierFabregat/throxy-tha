import { CompanyDataAICleaner } from "@/lib/ai/cleaning";
import {
  upsertCompany,
  updateCompanyEnrichment,
} from "@/server/db/company/mutations";
import type { AIModelInterface, CleaningResponse } from "@/lib/ai/types";
import type { UploadResult } from "./types";
import { CompanyEnrichmentService } from "@/lib/enrichment/service";
import type { NewsService } from "../enrichment/news/service";
import type { Company } from "../../server/db/schema";
import { CSVParser, type CSVParseOptions } from "@/lib/csv/parser";
import { CSVValidator } from "@/lib/csv/validator";

export class UploadService {
  private cleaner: CompanyDataAICleaner;
  private enrichmentService?: CompanyEnrichmentService;
  private csvParser: CSVParser;
  private csvValidator: CSVValidator;

  constructor(
    aiModel: AIModelInterface,
    newsService: NewsService,
    enableEnrichment = false,
    csvOptions?: CSVParseOptions,
  ) {
    this.cleaner = new CompanyDataAICleaner(aiModel);
    this.csvParser = new CSVParser(csvOptions);
    this.csvValidator = new CSVValidator();

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
      console.log("ℹ️ Starting CSV processing...");

      // Step 1: Parse CSV && Validated Data
      const parseResult = this.csvParser.parse(csvData);
      console.log(`ℹ️ Parsed ${parseResult.data.length} rows from CSV`);

      if (parseResult.warnings.length > 0) {
        console.warn("⚠️ CSV parsing warnings:", parseResult.warnings);
        result.errorDetails.push(...parseResult.warnings);
      }

      const validationResult = this.csvValidator.validate(parseResult.data);
      const businessRuleErrors = this.csvValidator.validateBusinessRules(
        validationResult.valid,
      );

      // Track validation results for better debugging and error handling (this could be done with a logging service, or an error tracking service like Sentry)
      result.processed = parseResult.data.length;
      result.errors =
        validationResult.invalid.length + businessRuleErrors.length;

      validationResult.invalid.forEach((error) => {
        result.errorDetails.push(`Row ${error.rowIndex}: ${error.error}`);
      });

      businessRuleErrors.forEach((error) => {
        result.errorDetails.push(`Row ${error.rowIndex}: ${error.error}`);
      });

      const validatedRows = validationResult.valid.filter(
        (row) => !businessRuleErrors.some((error) => error.data === row),
      );

      console.log(`✅ ${validatedRows.length} rows passed validation`);
      console.log(`❌ ${result.errors} rows failed validation`);

      if (validatedRows.length === 0) {
        throw new Error("No valid data rows found after validation");
      }

      // Step 2: AI Cleaning
      console.log(
        `🤖 Starting AI cleaning for ${validatedRows.length} validated rows...`,
      );

      // DESIGN DECISION: Use allSettled instead of all for better error handling
      // Why: Individual cleaning failures shouldn't stop the entire batch
      const cleaningResults = await Promise.allSettled(
        validatedRows.map(async (row, index) => {
          try {
            const cleaned = await this.cleaner.cleanData(row);
            return {
              success: true,
              data: cleaned,
              rowIndex: index + 1,
            };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown cleaning error",
              rowIndex: index + 1,
              originalRow: row,
            };
          }
        }),
      );

      // Process cleaning results and separate successful vs failed
      const cleanedCompanies: CleaningResponse[] = [];
      let cleaningErrors = 0;

      for (const promiseResult of cleaningResults) {
        if (promiseResult.status === "fulfilled") {
          const cleanResult = promiseResult.value;

          if (cleanResult.success && cleanResult.data) {
            cleanedCompanies.push(cleanResult.data);
          } else {
            cleaningErrors++;
            result.errors++;
            console.error(
              `❌ AI cleaning failed for row ${cleanResult.rowIndex}: ${cleanResult.error}`,
            );
            result.errorDetails.push(
              `Row ${cleanResult.rowIndex}: AI cleaning failed - ${cleanResult.error}`,
            );
          }
        } else {
          // This shouldn't happen with our error handling, but safety net
          cleaningErrors++;
          result.errors++;
          console.error(
            "Unexpected cleaning promise rejection:",
            promiseResult.reason,
          );
          result.errorDetails.push(
            `AI cleaning unexpected error: ${promiseResult.reason}`,
          );
        }
      }

      console.log(
        `🧹 AI cleaning completed: ${cleanedCompanies.length} succeeded, ${cleaningErrors} failed`,
      );

      if (cleanedCompanies.length === 0) {
        console.error("❌ AI cleaning completely failed for all rows");
        throw new Error("AI cleaning failed for all companies");
      }

      // Save all cleaned companies to database first (to get IDs)
      console.log(
        `ℹ️ Saving ${cleanedCompanies.length} companies to database...`,
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

        console.log(`ℹ️ Saving cleaned company ${i + 1}:`, {
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

      // PHASE 2: Parallel enrichment of saved companies (if enabled -- disable allowed for better api call control)
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

              // bang operator is safe because we know the enrichment service is defined since we checked it above
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
              "⚠️ Unexpected enrichment promise rejection:",
              promiseResult.reason,
            );
            result.errorDetails.push(
              `Unexpected enrichment error: ${promiseResult.reason}`,
            );
          }
        }

        console.log(
          `✅ Parallel enrichment completed! ${result.enriched} succeeded, ${result.enrichmentErrors} failed`,
        );
      } else if (!this.enrichmentService) {
        result.enrichmentSkipped = savedCompanies.length;
        console.log(
          `ℹ️ Enrichment skipped for ${savedCompanies.length} companies (feature disabled)`,
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
}
