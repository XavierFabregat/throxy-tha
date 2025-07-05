import { Queue, Worker, Job } from "bullmq";
import { redis } from "./connection";
import type { Company } from "../../server/db/schema";

// Job type definitions
export interface EnrichmentJobData {
  companyId: string;
  companyName: string;
  userId?: string;
}

export interface CSVProcessingJobData {
  csvData: string;
  enableEnrichment: boolean;
  userId?: string;
  uploadId: string;
  companies: Company[];
}

// Create queues
export const enrichmentQueue = new Queue<EnrichmentJobData>("enrichment", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

export const csvProcessingQueue = new Queue<CSVProcessingJobData>(
  "csv-processing",
  {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 50,
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 10000,
      },
    },
  },
);
