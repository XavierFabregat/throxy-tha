import { type NextRequest, NextResponse } from "next/server";
import { csvProcessingQueue } from "@/lib/queue/queue";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const enableEnrichment = formData.get("enableEnrichment") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "File must be a CSV" },
        { status: 400 },
      );
    }

    // NOTE: possible check to control file size
    // if (file.size > 5 * 1024 * 1024) {
    //   // 5MB limit
    //   return NextResponse.json(
    //     { error: "File too large (max 5MB)" },
    //     { status: 400 },
    //   );
    // }

    const uploadId = crypto.randomUUID();
    const csvContent = await file.text();

    // Queue the CSV processing job
    const job = await csvProcessingQueue.add(
      `csv-processing-${uploadId}`,
      {
        csvData: csvContent,
        enableEnrichment,
        uploadId,
        companies: [],
      },
      {
        // Job options
        priority: enableEnrichment ? 5 : 10, // Higher priority for enrichment
      },
    );

    return NextResponse.json({
      jobId: job.id,
      uploadId,
      status: "queued",
      message: "CSV processing started. Check status for updates.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
