import { env } from "@/env";
import type { NewsSearchResult } from "@/lib/types";

export class NewsService {
  private readonly baseUrl = "https://newsapi.org/v2/everything";
  private readonly apiKey = env.NEWS_API_KEY;

  async search(companyName: string): Promise<NewsSearchResult> {
    const response = await fetch(
      `${this.baseUrl}?q=${companyName}&apiKey=${this.apiKey}&sortBy=publishedAt&language=en&pageSize=100`,
    );
    const data = (await response.json()) as NewsSearchResult;
    return data;
  }
}
