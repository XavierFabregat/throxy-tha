import { Worker, type Job } from "bullmq";
import { redis } from "../connection";
import { UploadService } from "@/lib/upload/service";
import { AIModelFactory } from "@/lib/ai/providers/create-model";
import { NewsService } from "@/lib/enrichment/news/service";
import { enrichmentQueue } from "../queue";
import type { CSVProcessingJobData } from "../queue";

const csvProcessingWorker = new Worker<CSVProcessingJobData>(
  "csv-processing",
  async (job: Job<CSVProcessingJobData>) => {
    const { csvData, enableEnrichment, uploadId } = job.data;

    try {
      console.log("CSV processing worker started", job.id);
      await job.updateProgress(10);

      // Setup services
      const aiModel = AIModelFactory.createModel({
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 0.1,
      });

      const newsService = new NewsService();
      // Disable enrichment in upload service - we'll queue it separately
      const uploadService = new UploadService(aiModel, newsService, false);

      await job.updateProgress(30);
      console.log("CSV processing worker updated progress", job.id);

      // Process CSV without enrichment
      const result = await uploadService.processCSV(csvData);

      await job.updateProgress(70);
      console.log("CSV processing worker updated progress", job.id);

      // If enrichment is enabled, queue individual enrichment jobs
      if (enableEnrichment && result.inserted > 0) {
        // Queue enrichment jobs for each company
        const enrichmentJobs = result.companies.map((company) => ({
          // TODO: add a unique id to the job name
          name: `enrich-${company.id}`,
          data: {
            companyId: company.id,
            companyName: company.name,
            userId: job.data.userId,
          },
        }));

        await enrichmentQueue.addBulk(enrichmentJobs);
        result.enrichmentSkipped = result.companies.length;
      }

      await job.updateProgress(100);
      console.log("CSV processing worker updated progress", job.id);

      return result;
    } catch (error) {
      console.error(`CSV processing failed for upload ${uploadId}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2, // Process 2 CSV files simultaneously
  },
);

export { csvProcessingWorker };
