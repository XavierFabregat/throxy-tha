import { type NextRequest, NextResponse } from "next/server";
import {
  csvProcessingQueue,
  enrichmentQueue,
  type CSVProcessingJobData,
} from "@/lib/queue/queue";
import type { Job } from "bullmq";
import type { UploadResult } from "@/lib/upload/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  try {
    const { jobId } = params;

    // Check CSV processing queue first
    let job = (await csvProcessingQueue.getJob(jobId)) as Job;
    let queueType = "csv-processing";

    // If not found, check enrichment queue
    if (!job) {
      job = (await enrichmentQueue.getJob(jobId)) as Job;
      queueType = "enrichment";
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const state = await job.getState();
    const progress = job.progress;

    return NextResponse.json({
      jobId: job.id,
      queueType,
      state,
      progress,
      data: job.data as CSVProcessingJobData,
      result: job.returnvalue as UploadResult,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  } catch (error) {
    console.error("Job status error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get job status",
      },
      { status: 500 },
    );
  }
}
