import type { Company } from "@/server/db/schema";
import type { AIModelInterface } from "@/lib/ai/types";
import type {
  CompanySignals,
  NewsSearchResult,
  EnrichmentResult,
  NewsArticle,
} from "@/lib/types";
import { type NewsService } from "./news/service";

export class CompanyEnrichmentService {
  constructor(
    private readonly aiModel: AIModelInterface,
    private readonly newsService: NewsService,
  ) {}

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

      console.log("🔍 Enrichment result:", {
        signals,
        sources: newsResults.map((article) => article.url),
        enriched_at: new Date(),
        confidence_score: confidenceScore,
      });

      return {
        signals,
        sources: newsResults.map((article) => article.url),
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

  private async searchCompanyNews(companyName: string): Promise<NewsArticle[]> {
    const newsResults = await this.newsService.search(companyName);
    return newsResults.articles;
  }

  private async extractSignalsFromNews(
    company: Company,
    newsResults: NewsArticle[],
  ): Promise<CompanySignals> {
    const newsContent = newsResults
      .map(
        (result) =>
          `${result.title} (${result.publishedAt}): ${result.content}`,
      )
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

  // DESIGN DECISION: Use heuristic-based confidence scoring
  // Why: Simple to implement and understand, deterministic results
  // Alternative considered: ML-based scoring (too complex for MVP)
  // Trade-off: Accuracy vs simplicity
  private calculateConfidenceScore(
    newsResults: NewsArticle[],
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
          status: "ok",
          totalResults: 1,
          articles: [
            {
              title: "Apple Announces New AI Features for iPhone",
              content:
                "Apple unveiled advanced AI capabilities including improved Siri and machine learning features across its device ecosystem.",
              url: "https://example.com/apple-ai-features",
              publishedAt: "2024-01-15",
              source: {
                name: "Apple",
              },
              author: "John Doe",
              description:
                "Apple unveiled advanced AI capabilities including improved Siri and machine learning features across its device ecosystem.",
              urlToImage: "https://example.com/apple-ai-features.jpg",
            },
          ],
        },
      ],
      Netflix: [
        {
          status: "ok",
          totalResults: 1,
          articles: [
            {
              title: "Netflix Invests $2B in Original Content",
              content:
                "Streaming giant announces major investment in original programming and new studio acquisitions.",
              url: "https://example.com/netflix-investment",
              publishedAt: "2024-01-20",
              source: {
                name: "Netflix",
              },
              author: "John Doe",
              description:
                "Streaming giant announces major investment in original programming and new studio acquisitions.",
              urlToImage: "https://example.com/netflix-investment.jpg",
            },
          ],
        },
      ],
      Spotify: [
        {
          status: "ok",
          totalResults: 1,
          articles: [
            {
              title: "Spotify Launches AI Podcast Recommendations",
              content:
                "New machine learning algorithms help users discover personalized podcast content.",
              url: "https://example.com/spotify-ai",
              publishedAt: "2024-01-18",
              source: {
                name: "Spotify",
              },
              author: "John Doe",
              description:
                "New machine learning algorithms help users discover personalized podcast content.",
              urlToImage: "https://example.com/spotify-ai.jpg",
            },
          ],
        },
      ],
      Tesla: [
        {
          status: "ok",
          totalResults: 1,
          articles: [
            {
              title: "Tesla Opens New Gigafactory in Mexico",
              content:
                "Electric vehicle manufacturer expands global production capacity with new facility, hiring 3,000 workers.",
              url: "https://example.com/tesla-mexico",
              publishedAt: "2024-01-12",
              source: {
                name: "Tesla",
              },
              author: "John Doe",
              description:
                "Electric vehicle manufacturer expands global production capacity with new facility, hiring 3,000 workers.",
              urlToImage: "https://example.com/tesla-mexico.jpg",
            },
          ],
        },
      ],
      "Microsoft Corporation": [
        {
          status: "ok",
          totalResults: 1,
          articles: [
            {
              title: "Microsoft Acquires AI Startup for $1.2B",
              content:
                "Tech giant strengthens AI capabilities with strategic acquisition, integrating new technology into Office suite.",
              url: "https://example.com/microsoft-ai-acquisition",
              publishedAt: "2024-01-08",
              source: {
                name: "Microsoft",
              },
              author: "John Doe",
              description:
                "Tech giant strengthens AI capabilities with strategic acquisition, integrating new technology into Office suite.",
              urlToImage: "https://example.com/microsoft-ai-acquisition.jpg",
            },
          ],
        },
      ],
    };

    return (
      mockNews[companyName] ?? [
        {
          status: "ok",
          totalResults: 1,
          articles: [
            {
              title: `${companyName} Continues Growth Strategy`,
              content: `${companyName} focuses on market expansion and technology improvements to drive business growth.`,
              url: `https://example.com/${companyName.toLowerCase().replace(/\s+/g, "-")}-news`,
              publishedAt: "2024-01-12",
              source: {
                name: companyName,
              },
              author: "John Doe",
              description: `${companyName} focuses on market expansion and technology improvements to drive business growth.`,
              urlToImage: "https://example.com/microsoft-ai-acquisition.jpg",
            },
          ],
        },
      ]
    );
  }
}
