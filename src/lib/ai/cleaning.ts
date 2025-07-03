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

    const cleanedData = responses
      .map((response, index) => {
        if (!response.success || !response.data) {
          return null;
        }

        if (!this.isValidCleanedData(response.data)) {
          console.error("Invalid AI response format:", response.data);
          return null;
        }

        return {
          name: response.data.name,
          domain: response.data.domain,
          country: response.data.country,
          employee_size: response.data.employee_size,
          raw_json: raw[index]!,
        };
      })
      .filter((item) => item !== null);

    return {
      success: responses.every((r) => r.success),
      data: cleanedData,
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
    return `You are an intelligent data cleaning and enrichment specialist for company information.

OUTPUT FORMAT: Respond with valid JSON only:
{
  "name": "cleaned company name",
  "domain": "cleaned domain or best inference",
  "country": "full English country name", 
  "employee_size": "exact bucket from allowed list"
}

EMPLOYEE SIZE BUCKETS (use exactly):
${EMPLOYEE_SIZE_BUCKETS.map((bucket) => `"${bucket}"`).join(", ")}

CLEANING & INFERENCE RULES:
1. **Name**: Clean company names (proper capitalization, remove suffixes like Inc/LLC)

2. **Domain**: 
   - Clean existing domains (no http://, www., paths)
   - If domain is missing/invalid, INFER the most likely domain based on company name
   - Use your knowledge of well-known companies (e.g., "Apple" → "apple.com", "Netflix" → "netflix.com")
   - For unknown companies, make reasonable inference (e.g., "Acme Corp" → "acmecorp.com" or "acme.com")

3. **Country**: 
   - Convert country codes to full names (us→United States, uk→United Kingdom)
   - If country is missing, INFER based on company headquarters knowledge
   - Use your knowledge of where companies are based (e.g., "Apple" → "United States", "Spotify" → "Sweden")
   - If completely unknown, infer from context clues in other fields

4. **Employee Size**: 
   - Map existing employee info to closest bucket
   - If missing, INFER based on your knowledge of the company size
   - Use reasonable estimates for well-known companies
   - For unknown companies, default to "1-10" unless context suggests otherwise
   - Always map employee size to a bucket, even if inferred from other fields or other sources
   - If employee count is bigger than 10,000, map to "10,000+"
   - If employee count is smaller than 1, map to "1-10"

5. **Fix Data**:
    - If you are ABSOLUTELY SURE the data provided is incorrect, fix it
    - If you are not sure, leave it as is

EXAMPLES:
Input: {"name": "Apple", "domain": "", "country": "", "employee_size": ""}
Output: {"name": "Apple", "domain": "apple.com", "country": "United States", "employee_size": "10,000+"}

Input: {"name": "ACME startup", "domain": "broken-url", "country": "us", "employee_size": "small team"}
Output: {"name": "ACME Startup", "domain": "acme.com", "country": "United States", "employee_size": "1-10"}

IMPORTANT: Always provide your best inference rather than null/empty values when possible.`;
  }

  private buildCleaningPrompt(raw: RawCompanyData): string {
    return `Clean and enrich this company data. Use your knowledge to fill in missing information:

${JSON.stringify(raw, null, 2)}

Instructions:
- Clean existing data and fix formatting issues
- For missing/invalid fields, use your knowledge to make intelligent inferences
- Provide your best guess rather than leaving fields empty
- Be confident in your inferences for well-known companies

Return only the cleaned and enriched JSON.`;
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
      // since country is optional we only want to check that if its there its a string
      // if its not there we should not fail the validation
      "country" in data &&
      (typeof data.country === "string" || data.country === null) &&
      "employee_size" in data &&
      EMPLOYEE_SIZE_BUCKETS.includes(data.employee_size as EmployeeSizeBucket)
    );
  }
}
