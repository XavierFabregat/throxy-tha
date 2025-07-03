import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { companies } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { updateCompanyEnrichment } from "@/server/db/company/mutations";
import { CompanyEnrichmentService } from "@/lib/enrichment/service";
import { AIModelFactory } from "@/lib/ai/providers/create-model";
import { NewsService } from "@/lib/enrichment/news/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 },
      );
    }

    // Find the company
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Set up AI model for enrichment
    const modelConfig = {
      provider: "openai" as const,
      model: "gpt-4o-mini" as const,
      temperature: 0.1,
    };

    const aiModel = AIModelFactory.createModel(modelConfig);
    const newsService = new NewsService();
    const enrichmentService = new CompanyEnrichmentService(
      aiModel,
      newsService,
    );

    // Perform enrichment
    console.log(`🔍 Starting enrichment for company: ${company.name}`);
    const enrichmentResult = await enrichmentService.enrichCompany(company);

    // Save enrichment data to database
    const updatedCompany = await updateCompanyEnrichment(
      companyId,
      enrichmentResult,
    );

    console.log(
      `✅ Enrichment completed for ${company.name} with confidence score: ${enrichmentResult.confidence_score}%`,
    );

    return NextResponse.json({
      success: true,
      company: updatedCompany,
      enrichment: enrichmentResult,
    });
  } catch (error) {
    console.error("Enrichment error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Enrichment failed",
        success: false,
      },
      { status: 500 },
    );
  }
}
