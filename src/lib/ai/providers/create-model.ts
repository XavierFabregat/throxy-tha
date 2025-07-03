import { type AIModelInterface, type AIModelConfig } from "../types";
import { OpenAIProvider } from "./openai";

export class AIModelFactory {
  static createModel(config: AIModelConfig): AIModelInterface {
    switch (config.provider) {
      case "openai":
        return new OpenAIProvider(config);
      default:
        // This should never happen -- we only support OpenAI for now
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- this is a valid use case since we still have to handle default but eslint is going to complain that provider can't be anything else than openai
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  static getDefaultConfig(
    provider: AIModelConfig["provider"],
  ): Partial<AIModelConfig> {
    switch (provider) {
      case "openai":
        return {
          model: "gpt-4o-mini",
          temperature: 0.1,
          maxTokens: 1000,
        };
      default:
        return {};
    }
  }
}
