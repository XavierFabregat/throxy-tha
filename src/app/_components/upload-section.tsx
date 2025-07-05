"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { UploadResult } from "@/lib/upload/types";

interface JobStatus {
  jobId: string;
  state: "waiting" | "active" | "completed" | "failed";
  progress: number;
  result?: UploadResult;
}

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
  const [uploadStatus, setUploadStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("enableEnrichment", "true");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        jobId: string;
        error?: string;
      };

      if (response.ok) {
        setUploadStatus({
          jobId: data.jobId,
          state: "waiting",
          progress: 0,
        });
        setIsPolling(true);
      } else {
        // Handle error
        console.error("Upload failed:", data.error);
      }
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const pollJobStatus = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/jobs/${jobId}`);
    const status = (await response.json()) as JobStatus;
    return status;
  }, []);

  const startPolling = useCallback(
    async (jobId: string) => {
      const status = await pollJobStatus(jobId);
      setUploadStatus(status);
      if (status.state === "completed" || status.state === "failed") {
        setIsPolling(false);
      }
    },
    [pollJobStatus],
  );

  // Poll for job status
  useEffect(() => {
    if (!isPolling || !uploadStatus?.jobId) return;

    const pollInterval = setInterval(() => {
      void startPolling(uploadStatus.jobId);
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isPolling, uploadStatus?.jobId, startPolling]);

  return (
    <div className="space-y-4">
      <div className="flex w-full items-center justify-between gap-4 border-1 border-t border-b p-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Upload CSV</h2>
          <input
            type="file"
            accept=".csv"
            onChange={handleUpload}
            disabled={isPolling}
            className="border-input w-full rounded-md border border-1 p-2"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enableEnrichment}
              onChange={(e) => onEnrichmentChange(e.target.checked)}
              disabled={isPolling}
              className="rounded"
            />
            <span>Enrich company data during upload</span>
          </label>
          {isPolling && (
            <p className="text-sm text-gray-600">
              {enableEnrichment
                ? "Processing and enriching..."
                : "Processing..."}
            </p>
          )}
        </div>

        <Button
          variant="destructive"
          onClick={onDeleteAll}
          disabled={isPolling}
        >
          Delete All Companies
        </Button>
      </div>

      {uploadStatus && (
        <div className="rounded border p-4">
          <div className="mb-2">
            <span className="font-semibold">Status:</span> {uploadStatus.state}
          </div>
          <div className="mb-2">
            <span className="font-semibold">Progress:</span>{" "}
            {uploadStatus.progress}%
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadStatus.progress}%` }}
            />
          </div>

          {uploadStatus.result && (
            <div className="mt-4 rounded border border-green-200 bg-green-50 p-3">
              <p>✅ Processing completed!</p>
              <p>Processed: {uploadStatus.result.processed}</p>
              <p>Inserted: {uploadStatus.result.inserted}</p>
              <p>Enriched: {uploadStatus.result.enriched}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
