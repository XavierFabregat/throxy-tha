import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import type { Company } from "../../server/db/schema";
import type { EnrichmentResult, CompanySignals } from "@/lib/types";
import { Button } from "../../components/ui/button";

function formatEnrichmentData(enrichmentData: EnrichmentResult | null): {
  signals: CompanySignals;
  confidence_score: number;
  enriched_at: string;
  sources_count: number;
} | null {
  if (!enrichmentData) {
    return null;
  }

  return {
    signals: enrichmentData.signals || {
      recent_news: [],
      hiring_signals: [],
      funding_events: [],
      technology_adoption: [],
      trigger_events: [],
      growth_indicators: [],
      leadership_changes: [],
    },
    confidence_score: enrichmentData.confidence_score || 0,
    enriched_at: enrichmentData.enriched_at
      ? new Date(enrichmentData.enriched_at).toLocaleDateString()
      : "Unknown",
    sources_count: enrichmentData.sources?.length || 0,
  };
}

function SignalSection({
  title,
  signals,
  emoji,
}: {
  title: string;
  signals: string[];
  emoji: string;
}) {
  if (signals.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span>{emoji}</span>
        {title} ({signals.length})
      </h4>
      <ul className="space-y-1">
        {signals.map((signal, index) => (
          <li
            key={index}
            className="border-l-2 border-gray-200 pl-4 text-sm text-gray-600"
          >
            {signal}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EnrichDialog({
  company,
  handleEnrich,
}: {
  company: Company;
  handleEnrich: (companyId: string) => void;
}) {
  const enrichment = formatEnrichmentData(company.enrichment_data);

  if (!enrichment) {
    return (
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enrichment Data - {company.name}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          No enrichment data available for this company.
        </DialogDescription>
      </DialogContent>
    );
  }

  const { signals, confidence_score, enriched_at, sources_count } = enrichment;

  return (
    <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          🏢 Sales Intelligence - {company.name}
        </DialogTitle>
        <DialogDescription className="flex items-center gap-4 text-sm">
          <span>
            Confidence: <strong>{confidence_score}%</strong>
          </span>
          <span>
            Sources: <strong>{sources_count}</strong>
          </span>
          <span>
            Enriched: <strong>{enriched_at}</strong>
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="mt-6 space-y-6">
        <SignalSection
          title="Recent Business News"
          signals={signals.recent_news}
          emoji="📰"
        />

        <SignalSection
          title="Hiring & Growth Signals"
          signals={signals.hiring_signals}
          emoji="👥"
        />

        <SignalSection
          title="Funding & Investment Events"
          signals={signals.funding_events}
          emoji="💰"
        />

        <SignalSection
          title="Technology Adoption"
          signals={signals.technology_adoption}
          emoji="🔧"
        />

        <SignalSection
          title="Trigger Events"
          signals={signals.trigger_events}
          emoji="📋"
        />

        <SignalSection
          title="Growth Indicators"
          signals={signals.growth_indicators}
          emoji="📈"
        />

        <SignalSection
          title="Leadership Changes"
          signals={signals.leadership_changes}
          emoji="👔"
        />

        {Object.values(signals).every(
          (arr) => Array.isArray(arr) && arr.length === 0,
        ) && (
          <div className="py-8 text-center text-gray-500">
            <p>No sales signals detected for this company.</p>
            <p className="mt-2 text-sm">
              This could indicate limited recent news coverage or the need for
              better data sources.
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button
            onClick={() => {
              //
              handleEnrich(company.id);
            }}
          >
            Enrich Again
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}
