import { type NextRequest, NextResponse } from "next/server";
import { UploadService } from "@/lib/upload/service";
import { AIModelFactory } from "@/lib/ai/providers/create-model";
import type { AIModelConfig } from "@/lib/ai/types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "File must be a CSV" },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 400 },
      );
    }

    const modelConfig: AIModelConfig = {
      provider: "openai" as const,
      model: "gpt-4o-mini" as const,
      temperature: 0.1,
    };

    const aiModel = AIModelFactory.createModel(modelConfig);
    const uploadService = new UploadService(aiModel);

    // Process the CSV
    const csvContent = await file.text();
    const result = await uploadService.processCSV(csvContent);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        errorDetails: [
          error instanceof Error ? error.message : "Unknown error",
        ],
      },
      { status: 500 },
    );
  }
}
