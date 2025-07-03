import type { Company } from "@/server/db/schema";
import type { AIModelInterface } from "@/lib/ai/types";
import type {
  CompanySignals,
  NewsSearchResult,
  EnrichmentResult,
} from "@/lib/types";

export class CompanyEnrichmentService {
  constructor(private readonly aiModel: AIModelInterface) {}

  async enrichCompany(company: Company): Promise<EnrichmentResult> {
    try {
      // 1. Search for recent company news
      const newsResults = await this.searchCompanyNews(company.name);

      // 2. Extract signals using AI
      const signals = await this.extractSignalsFromNews(company, newsResults);

      // 3. Calculate confidence score based on news recency and relevance
      const confidenceScore = this.calculateConfidenceScore(
        newsResults,
        signals,
      );

      return {
        signals,
        sources: newsResults,
        enriched_at: new Date(),
        confidence_score: confidenceScore,
      };
    } catch (error) {
      console.error("Enrichment failed for company:", company.name, error);
      throw new Error(
        `Failed to enrich company data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async searchCompanyNews(
    companyName: string,
  ): Promise<NewsSearchResult[]> {
    // For demo purposes, we'll use mock data
    // In production, you'd use Google Search API, Bing API, or similar
    return this.getMockNewsData(companyName);
  }

  private async extractSignalsFromNews(
    company: Company,
    newsResults: NewsSearchResult[],
  ): Promise<CompanySignals> {
    const newsContent = newsResults
      .map((result) => `${result.title}: ${result.snippet}`)
      .join("\n\n");

    const prompt = `Analyze this recent news about ${company.name} and extract sales-relevant signals:

Company: ${company.name}
Domain: ${company.domain ?? "unknown"}
Country: ${company.country}
Employee Size: ${company.employee_size}

Recent News:
${newsContent}

Extract actionable signals for sales outreach. Return JSON with these categories:

{
  "recent_news": ["Key business updates that sales teams could reference"],
  "hiring_signals": ["Evidence of growth through hiring"],
  "funding_events": ["Investment rounds, acquisitions, IPOs"],
  "technology_adoption": ["New tech stack, platform migrations, tool adoption"],
  "trigger_events": ["Leadership changes, office moves, partnerships"],
  "growth_indicators": ["Revenue growth, market expansion, new products"],
  "leadership_changes": ["New executives, promotions, departures"]
}

Focus on recent events (last 6 months) that would be relevant for personalized outreach.
Only include signals that are clearly supported by the news content.
If no relevant signals found for a category, use an empty array.`;

    try {
      const response = await this.aiModel.cleanData({
        data: { news_content: newsContent, company_info: company },
        systemPrompt:
          "You are a sales intelligence analyst extracting actionable insights from company news.",
        userPrompt: prompt,
      });

      if (!response?.success || !response.data) {
        throw new Error("AI signal extraction failed");
      }

      return this.validateSignals(response.data);
    } catch (error) {
      console.error("AI signal extraction failed:", error);
      return this.getEmptySignals();
    }
  }

  private validateSignals(data: unknown): CompanySignals {
    const defaultSignals = this.getEmptySignals();

    if (typeof data !== "object" || !data) {
      return defaultSignals;
    }

    const signals = data as Record<string, unknown>;

    return {
      recent_news: Array.isArray(signals.recent_news)
        ? (signals.recent_news as string[])
        : [],
      hiring_signals: Array.isArray(signals.hiring_signals)
        ? (signals.hiring_signals as string[])
        : [],
      funding_events: Array.isArray(signals.funding_events)
        ? (signals.funding_events as string[])
        : [],
      technology_adoption: Array.isArray(signals.technology_adoption)
        ? (signals.technology_adoption as string[])
        : [],
      trigger_events: Array.isArray(signals.trigger_events)
        ? (signals.trigger_events as string[])
        : [],
      growth_indicators: Array.isArray(signals.growth_indicators)
        ? (signals.growth_indicators as string[])
        : [],
      leadership_changes: Array.isArray(signals.leadership_changes)
        ? (signals.leadership_changes as string[])
        : [],
    };
  }

  private getEmptySignals(): CompanySignals {
    return {
      recent_news: [],
      hiring_signals: [],
      funding_events: [],
      technology_adoption: [],
      trigger_events: [],
      growth_indicators: [],
      leadership_changes: [],
    };
  }

  private calculateConfidenceScore(
    newsResults: NewsSearchResult[],
    signals: CompanySignals,
  ): number {
    let score = 0;

    // Base score from number of news articles
    score += Math.min(newsResults.length * 10, 30);

    // Score from number of signals extracted
    const totalSignals = Object.values(signals).flat().length;
    score += Math.min(totalSignals * 5, 40);

    // Bonus for high-value signals
    if (signals.funding_events.length > 0) score += 20;
    if (signals.leadership_changes.length > 0) score += 15;
    if (signals.hiring_signals.length > 0) score += 10;

    return Math.min(score, 100);
  }

  private getMockNewsData(companyName: string): NewsSearchResult[] {
    // Mock data for demonstration - in production, replace with real search API
    const mockNews: Record<string, NewsSearchResult[]> = {
      "Apple Inc.": [
        {
          title: "Apple Announces New AI Features for iPhone",
          snippet:
            "Apple unveiled advanced AI capabilities including improved Siri and machine learning features across its device ecosystem.",
          url: "https://example.com/apple-ai-features",
          date: "2024-01-15",
        },
        {
          title: "Apple Expands Manufacturing Operations",
          snippet:
            "The tech giant is hiring 2,000 engineers and expanding production facilities to meet growing demand.",
          url: "https://example.com/apple-expansion",
          date: "2024-01-10",
        },
      ],
      Netflix: [
        {
          title: "Netflix Invests $2B in Original Content",
          snippet:
            "Streaming giant announces major investment in original programming and new studio acquisitions.",
          url: "https://example.com/netflix-investment",
          date: "2024-01-20",
        },
      ],
      Spotify: [
        {
          title: "Spotify Launches AI Podcast Recommendations",
          snippet:
            "New machine learning algorithms help users discover personalized podcast content.",
          url: "https://example.com/spotify-ai",
          date: "2024-01-18",
        },
      ],
      Tesla: [
        {
          title: "Tesla Opens New Gigafactory in Mexico",
          snippet:
            "Electric vehicle manufacturer expands global production capacity with new facility, hiring 3,000 workers.",
          url: "https://example.com/tesla-mexico",
          date: "2024-01-12",
        },
      ],
      "Microsoft Corporation": [
        {
          title: "Microsoft Acquires AI Startup for $1.2B",
          snippet:
            "Tech giant strengthens AI capabilities with strategic acquisition, integrating new technology into Office suite.",
          url: "https://example.com/microsoft-ai-acquisition",
          date: "2024-01-08",
        },
      ],
    };

    return (
      mockNews[companyName] ?? [
        {
          title: `${companyName} Continues Growth Strategy`,
          snippet: `${companyName} focuses on market expansion and technology improvements to drive business growth.`,
          url: `https://example.com/${companyName.toLowerCase().replace(/\s+/g, "-")}-news`,
          date: "2024-01-12",
        },
      ]
    );
  }
}
