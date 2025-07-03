"use client";

import { Button } from "@/components/ui/button";

interface UploadSectionProps {
  uploadLoading: boolean;
  enableEnrichment: boolean;
  onEnrichmentChange: (enabled: boolean) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteAll: () => void;
}

export function UploadSection({
  uploadLoading,
  enableEnrichment,
  onEnrichmentChange,
  onUpload,
  onDeleteAll,
}: UploadSectionProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4 border-1 border-t border-b p-2">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Upload CSV</h2>
        <input
          type="file"
          accept=".csv"
          onChange={onUpload}
          disabled={uploadLoading}
          className="border-input w-full rounded-md border border-1 p-2"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enableEnrichment}
            onChange={(e) => onEnrichmentChange(e.target.checked)}
            disabled={uploadLoading}
            className="rounded"
          />
          <span>Enrich company data during upload</span>
        </label>
        {uploadLoading && (
          <p className="text-sm text-gray-600">
            {enableEnrichment ? "Processing and enriching..." : "Processing..."}
          </p>
        )}
      </div>

      <Button
        variant="destructive"
        onClick={onDeleteAll}
        disabled={uploadLoading}
      >
        Delete All Companies
      </Button>
    </div>
  );
}
