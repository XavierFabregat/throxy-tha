# Company Enrichment Service

This project takes basic company information (name, domain, country, employee size) and enriches it with sales-relevant insights by analyzing recent news coverage. The goal is to help sales teams identify the right time to reach out to prospects by surfacing trigger events like funding rounds, leadership changes, or growth indicators.

## Design Decisions & Trade-offs

### Problem Breakdown

**Original Challenge**: "Build a small, production‑style system that ingests a messy company CSV, cleans & enriches the data, stores it in Postgres, and exposes a minimal API + React UI so we can filter the records by country, employee size, and domain."

**How I Structured This**:

1. **Data Flow**: CSV -> Parse -> Clean + Enrich -> Store -> (*1)Display -> (?) Enrich -> Store -> Display(*1)
2. **Core Challenge**: Transform unstructured news into structured usable data.
3. **Key Components**: Data ingestion, data cleaning, data enrichment, data dispaly.

### Major Design Decisions

#### 1. AI-First vs Heuristic cleaning

**Decision**: Use LLM (GPT-4) for data cleaning
**Alternatives Considered**:

- Heuristic rule base approach (❌too complicated, ❌difficult to scale, ✅deterministic)

**Trade-offs**:
✅ **Pros**: Handles context, adapts to language variations, no manual rule maintenance
❌ **Cons**: Higher cost (~$0.01-0.03 per company), slower processing, non-deterministic

#### 2. Synchronous vs Asynchronous Enrichment

**Decision**: Moved to parallel synchronous enrichment for better performance
**Why**: MVP simplicity. Real production would need async processing, with queues and more sophisticated logic.
**Trade-off**: Simple implementation vs poor UX for large datasets

## Whys:

### Why LLMs Over Traditional Scraping?

I chose to use Large Language Models (GPT-4) for signal extraction instead of traditional web scraping or rule-based parsing for several key reasons:

**Flexibility & Adaptability**: News articles come in countless formats and styles. Writing regex patterns or scrapers for every possible news site would be a nightmare to maintain. LLMs can understand context and meaning regardless of the specific formatting or writing style.

**Semantic Understanding**: Not just looking for keywords - but understainding _what_ the news means for sales teams. An LLM can distinguish between "Company X hired a new janitor" (probably not sales-relevant) and "Company X hired a new CTO" (definitely worth knowing about).

**Future-Proofing**: As news sites change their layouts or new sources emerge, our LLM-based approach continues working without code changes. Traditional scrapers would break constantly.

**Signal Quality**: The AI can make nuanced judgments about what constitutes a "growth indicator" or "trigger event" that would be nearly impossible to capture with simple pattern matching.

**Customizability**: LLMs can be fine-tuned or prompted differently for specific industries or use cases without changing the core architecture.

### News API Choice

I went with NewsAPI instead of building our own web scraping infrastructure because:

**Reliability**: NewsAPI handles rate limiting, provides consistent data formats, and has much better uptime than rolling our own scrapers that could get blocked.

**Legal Compliance**: Using an official API means we don't have to worry about scraping terms of service or getting IP-banned from news sites.

**Coverage**: NewsAPI aggregates from thousands of sources, giving us much broader coverage than we could realistically scrape ourselves.

**Speed**: API calls are faster and more predictable than web scraping, especially when you factor in parsing HTML, handling different site structures, etc.

The trade-off is cost and dependency on a third-party service, but for a production system, the reliability benefits far outweigh these concerns.

### Architecture Choices

**Separation of Concerns**: Splitting NewsService and CompanyEnrichmentService to make testing easier and allow for different news sources in the future.

**Error Handling**: Graceful degradation - if news search fails, enrichment continues with empty data rather than failing completely.

## What I'd Add With More Time

### Enhanced Data Sources

- **Social Media Integration**: Twitter/LinkedIn API integration to catch signals that don't make it to news
- **Job Board Monitoring**: Track hiring patterns from company career pages
- **Financial Data**: SEC filings, funding databases for more comprehensive financial signals

### Smarter AI Processing

- **Multi-step Reasoning**: Chain multiple AI calls to validate and cross-reference signals
- **Confidence Scoring**: More sophisticated scoring that factors in source credibility and recency
- **Signal Categorization**: Automatic tagging of signal urgency/importance for sales prioritization
- **Testing**: Robust testing of key functionalities to make scaling and mantaining the code much easier.

### User Experience Improvements

- **Real-time Updates**: WebSocket connections for live enrichment status
- **Bulk Enrichment**: Queue system for processing large company lists
- **Custom Signal Types**: Allow users to define their own signal categories
- **Integration Webhooks**: Push enriched data to CRM systems automatically

### Performance & Scale

- **Background Processing**: Move enrichment to background workers with job queues
- **Edge Caching**: CDN-level caching for frequently accessed companies

## Testing Strategy

### Unit Testing

We'd focus on testing each service in isolation:

```typescript
// Example test structure
describe("NewsService", () => {
  it("should handle API errors gracefully");
  it("should cache results properly");
  it("should validate input parameters");
});

describe("CompanyEnrichmentService", () => {
  it("should extract signals from mock news data");
  it("should calculate confidence scores correctly");
  it("should handle empty news results");
});
```

### Integration Testing

- **API Endpoint Testing**: Verify the enrichment flow end-to-end
- **Database Operations**: Test company creation, updates, and queries
- **Error Scenarios**: Network failures, malformed responses, rate limiting

### E2E Testing

- **Full User Workflows**: Upload CSV → enrich companies → view results
- **Performance Testing**: Load testing with realistic data volumes
- **Browser Testing**: Cross-browser compatibility for the UI

### Testing Challenges & Solutions

**API Mocking**: NewsAPI calls need to be mocked for consistent test results. I'd use MSW (Mock Service Worker) to intercept network requests.

**LLM Testing**: AI responses are non-deterministic, so we'd test with fixed mock responses and validate the parsing logic separately from the AI calls.

**Data Consistency**: Tests need predictable data states, so we'd use factory patterns for test data generation.

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Start the database: `./start-database.sh`
5. Push db schema: `npm run db:push`
6. Run the development server: `npm run dev`

## Environment Variables

- `NEWS_API_KEY`: Get from [NewsAPI.org](https://newsapi.org)
- `OPENAI_API_KEY`: For the AI signal extraction
