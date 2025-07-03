import OpenAI from "openai";
import {
  type AIModelInterface,
  type CleaningRequest,
  type CleaningResponse,
  type AIModelConfig,
  type CleanedData,
} from "../types";

export class OpenAIProvider implements AIModelInterface {
  private client: OpenAI;
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async cleanData(request: CleaningRequest): Promise<CleaningResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: this.config.temperature ?? 0.1,
        max_tokens: this.config.maxTokens ?? 1000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return { success: false, error: "No response from model" };
      }

      let data: CleanedData;
      try {
        data = JSON.parse(content) as CleanedData;
      } catch (error) {
        // handle error gracefully -- add retry logic here
        console.error("Invalid JSON response from model", error);
        return { success: false, error: "Invalid JSON response from model" };
      }

      return {
        success: true,
        data,
        tokensUsed: completion.usage?.total_tokens,
        cost: this.calculateCost(completion.usage?.total_tokens ?? 0),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async batchCleanData(
    requests: CleaningRequest[],
  ): Promise<CleaningResponse[]> {
    // Process requests in parallel with rate limiting
    const results: CleaningResponse[] = [];
    const batchSize = 5; // Adjust based on rate limits

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map((request) => this.cleanData(request));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting delay
      if (i + batchSize < requests.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  getProvider() {
    return "openai" as const;
  }
  getModel() {
    return this.config.model;
  }

  getCostEstimate(tokens: number): number {
    // Pricing per 1M tokens (taken from OpenAI @ https://platform.openai.com/docs/pricing)
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4o": { input: 2.5, output: 10 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-4-turbo": { input: 10, output: 30 },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    };

    const modelPricing = pricing[this.config.model];
    if (!modelPricing) return 0;

    // Estimate 70% input, 30% output tokens
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return (
      (inputTokens * modelPricing.input + outputTokens * modelPricing.output) /
      1000000
    );
  }

  private calculateCost(tokens: number): number {
    return this.getCostEstimate(tokens);
  }
}
