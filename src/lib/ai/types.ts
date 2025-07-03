import type { EmployeeSizeBucket, RawCompanyData } from "../types";

// For this case only OpenAI -- extend as more models are added
export type AIModelProvider = "openai";
export type AIModel =
  // OpenAI Models
  "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-3.5-turbo";

export interface AIModelConfig {
  provider: AIModelProvider;
  model: AIModel;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface CleaningRequest {
  data: RawCompanyData;
  systemPrompt: string;
  userPrompt: string;
}

export interface CleaningResponse {
  success: boolean;
  data?: CleanedData;
  error?: string;
  tokensUsed?: number;
  cost?: number;
}

export interface BatchCleaningRequest {
  data: RawCompanyData[];
  systemPrompt: string;
  userPrompt: string;
}

export interface BatchCleaningResponse {
  success: boolean;
  data: CleanedData[];
  error?: string;
  tokensUsed?: number;
  cost?: number;
}

export interface CleanedData {
  name: string;
  domain: string | null;
  country: string;
  employee_size: EmployeeSizeBucket;
  raw_json: RawCompanyData;
}

// Abstract interface for all AI providers
export interface AIModelInterface {
  cleanData(request: CleaningRequest): Promise<CleaningResponse>;
  batchCleanData(requests: CleaningRequest[]): Promise<CleaningResponse[]>;
  getProvider(): AIModelProvider;
  getModel(): AIModel;
  getCostEstimate(tokens: number): number;
}
