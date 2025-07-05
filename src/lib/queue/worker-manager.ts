import { csvProcessingWorker } from "./workers/csv-processing-worker";
import { enrichmentWorker } from "./workers/enrichment-worker";
import type { Job, Worker } from "bullmq";

export class WorkerManager {
  private static instance: WorkerManager;
  private workers: Worker[] = [];

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  async startWorkers() {
    try {
      console.log("🚀 Starting BullMQ workers...");

      // Start workers
      this.workers = [csvProcessingWorker, enrichmentWorker];

      // Add error handling
      this.workers.forEach((worker) => {
        worker.on("completed", (job: Job) => {
          console.log(`✅ Job ${job.id} completed`);
        });

        worker.on("failed", (job: Job | undefined, err: Error) => {
          if (job) {
            console.error(`❌ Job ${job.id} failed:`, err);
          } else {
            console.error("❌ Job failed:", err);
          }
        });

        worker.on("error", (err: Error) => {
          console.error("Worker error:", err);
        });
      });

      console.log("✅ All workers started successfully");
    } catch (error) {
      console.error("Failed to start workers:", error);
    }
  }

  async stopWorkers() {
    console.log("🛑 Stopping BullMQ workers...");
    await Promise.all(this.workers.map((worker) => worker.close()));
    console.log("✅ All workers stopped");
  }
}
