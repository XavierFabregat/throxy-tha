import { Worker, type Job } from "bullmq";
import { redis } from "../connection";
import { CompanyEnrichmentService } from "@/lib/enrichment/service";
import { AIModelFactory } from "@/lib/ai/providers/create-model";
import { updateCompanyEnrichment } from "@/server/db/company/mutations";
import type { EnrichmentJobData } from "../queue";
import { NewsService } from "../../enrichment/news/service";
import { findByName } from "@/server/db/company/queries";

const enrichmentWorker = new Worker<EnrichmentJobData>(
  "enrichment",
  async (job: Job<EnrichmentJobData>) => {
    const { companyId, companyName } = job.data;

    try {
      // Update progress
      await job.updateProgress(10);

      // Setup AI model
      const aiModel = AIModelFactory.createModel({
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 0.1,
      });
      const newsService = new NewsService();

      const enrichmentService = new CompanyEnrichmentService(
        aiModel,
        newsService,
      );

      await job.updateProgress(30);

      // Get company data
      const company = await findByName(companyName);
      if (!company) {
        throw new Error(`Company not found: ${companyId}`);
      }

      await job.updateProgress(50);

      // Perform enrichment
      const enrichmentResult = await enrichmentService.enrichCompany(company);

      await job.updateProgress(80);

      // Save results
      await updateCompanyEnrichment(companyId, enrichmentResult);

      await job.updateProgress(100);

      return {
        success: true,
        companyId,
        companyName,
        confidence: enrichmentResult.confidence_score,
      };
    } catch (error) {
      console.error(`Enrichment failed for ${companyName}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5, // Process 5 enrichments simultaneously
  },
);

export { enrichmentWorker };
