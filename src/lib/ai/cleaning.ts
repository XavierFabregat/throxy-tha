import type { RawCompanyData, EmployeeSizeBucket } from "../types";
import { EMPLOYEE_SIZE_BUCKETS } from "../types";
import type {
  AIModelInterface,
  BatchCleaningResponse,
  CleaningRequest,
  CleaningResponse,
} from "./types";

export class CompanyDataAICleaner {
  constructor(private readonly ai: AIModelInterface) {}

  async cleanData(raw: RawCompanyData): Promise<CleaningResponse | null> {
    // Skip if no company name
    if (!raw.name?.trim()) return null;

    try {
      const request: CleaningRequest = {
        data: raw,
        systemPrompt: this.getSystemPrompt(),
        userPrompt: this.buildCleaningPrompt(raw),
      };

      const response = await this.ai.cleanData(request);

      if (!response.success || !response.data) {
        console.error("AI cleaning failed:", response.error);
        return null;
      }

      if (!this.isValidCleanedData(response.data)) {
        console.error("Invalid AI response format:", response.data);
        return null;
      }

      const data = {
        name: response.data.name,
        domain: response.data.domain,
        country: response.data.country,
        employee_size: response.data.employee_size,
        raw_json: raw,
      };

      return {
        success: true,
        data,
        tokensUsed: response.tokensUsed,
        cost: response.cost,
      };
    } catch (error) {
      console.error("AI cleaning error:", error);
      return null;
    }
  }

  async cleanBatchData(
    raw: RawCompanyData[],
  ): Promise<BatchCleaningResponse | null> {
    const requests: CleaningRequest[] = raw.map((r) => ({
      data: r,
      systemPrompt: this.getSystemPrompt(),
      userPrompt: this.buildCleaningPrompt(r),
    }));

    const responses = await this.ai.batchCleanData(requests);

    return {
      success: responses.every((r) => r.success),
      data: responses.map((r) => r.data).filter((r) => r !== undefined),
      tokensUsed: responses.reduce((acc, r) => acc + (r.tokensUsed ?? 0), 0),
      cost: responses.reduce((acc, r) => acc + (r.cost ?? 0), 0),
      error: responses.find((r) => r.error)?.error,
    };
  }

  getModelInfo() {
    return {
      provider: this.ai.getProvider(),
      model: this.ai.getModel(),
    };
  }

  estimateCost(tokenCount: number): number {
    return this.ai.getCostEstimate(tokenCount);
  }

  private getSystemPrompt(): string {
    return `You are a data cleaning specialist for company information.

OUTPUT FORMAT: Respond with valid JSON only:
{
  "name": "cleaned company name",
  "domain": "cleaned domain or null",
  "country": "full English country name", 
  "employee_size": "exact bucket from allowed list"
}

EMPLOYEE SIZE BUCKETS (use exactly):
${EMPLOYEE_SIZE_BUCKETS.map((bucket) => `"${bucket}"`).join(", ")}

RULES:
1. Clean company names (proper capitalization, remove suffixes like Inc/LLC)
2. Extract valid domains (no http://, www., paths). Return null if invalid
3. Convert country codes to full names (us→United States, uk→United Kingdom)
4. Map employee info to closest bucket`;
  }

  private buildCleaningPrompt(raw: RawCompanyData): string {
    return `Clean this company data:\n\n${JSON.stringify(raw, null, 2)}\n\nReturn only the cleaned JSON.`;
  }

  private isValidCleanedData(data: unknown): boolean {
    if (typeof data !== "object" || data === null) return false;
    return (
      typeof data === "object" &&
      "name" in data &&
      typeof data.name === "string" &&
      data.name.length > 0 &&
      "domain" in data &&
      (data.domain === null || typeof data.domain === "string") &&
      "country" in data &&
      typeof data.country === "string" &&
      "employee_size" in data &&
      EMPLOYEE_SIZE_BUCKETS.includes(data.employee_size as EmployeeSizeBucket)
    );
  }
}
