"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Company } from "@/server/db/schema";
import type { UploadResult } from "@/lib/upload/types";
import { UploadSection } from "./_components/upload-section";
import { CompanyFilters } from "./_components/company-filters";
import { CompanyTable } from "./_components/company-table";
import type { CompaniesResponse } from "../lib/types";

export default function HomePage() {
  // State management
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [enrichingCompanies, setEnrichingCompanies] = useState<Set<string>>(
    new Set(),
  );
  const [name, setName] = useState("");
  const [filters, setFilters] = useState({
    country: "",
    employee_size: "",
    domain: "",
  });
  const [enableEnrichment, setEnableEnrichment] = useState(false);

  // Computed values
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) =>
      company.name.toLowerCase().includes(name.toLowerCase()),
    );
  }, [companies, name]);

  // API functions
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/companies?${params}`);
      const data = (await response.json()) as CompaniesResponse;

      if (response.ok) {
        setCompanies(data.companies);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("enableEnrichment", enableEnrichment.toString());

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as UploadResult;

      if (response.ok) {
        const message = enableEnrichment
          ? `Upload completed!\nProcessed: ${result.processed}\nInserted: ${result.inserted}\nUpdated: ${result.updated}\nEnriched: ${result.enriched}\nEnrichment Errors: ${result.enrichmentErrors}\nErrors: ${result.errors}`
          : `Upload completed!\nProcessed: ${result.processed}\nInserted: ${result.inserted}\nUpdated: ${result.updated}\nErrors: ${result.errors}`;

        alert(message);
        void fetchCompanies();
      } else {
        alert(`Upload failed: ${result.errorDetails[0] ?? "Unknown error"}`);
      }
    } catch (error) {
      alert("Upload failed");
      console.error("Upload failed:", error);
    } finally {
      setUploadLoading(false);
      event.target.value = "";
    }
  };

  const handleEnrich = async (companyId: string) => {
    setEnrichingCompanies((prev) => new Set(prev).add(companyId));
    try {
      const response = await fetch(`/api/companies/${companyId}/enrich`, {
        method: "POST",
      });

      const result = (await response.json()) as {
        enrichment?: { confidence_score: number };
        error?: string;
      };

      if (response.ok && result.enrichment) {
        alert(
          `Enrichment completed with ${result.enrichment.confidence_score}% confidence!`,
        );
        void fetchCompanies();
      } else {
        alert(`Enrichment failed: ${result.error ?? "Unknown error"}`);
      }
    } catch (error) {
      alert("Enrichment failed");
      console.error("Enrichment failed:", error);
    } finally {
      setEnrichingCompanies((prev) => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }
  };

  const handleDeleteAll = async () => {
    try {
      await fetch("/api/companies", { method: "DELETE" });
      alert("All companies deleted");
      void fetchCompanies();
    } catch (error) {
      alert("Failed to delete companies");
      console.error("Delete failed:", error);
    }
  };

  // Effects
  useEffect(() => {
    void fetchCompanies();
  }, [filters, fetchCompanies]);

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex h-full w-full flex-col gap-4">
        <h1 className="text-2xl font-bold">Company Data Platform</h1>

        <UploadSection
          uploadLoading={uploadLoading}
          enableEnrichment={enableEnrichment}
          onEnrichmentChange={setEnableEnrichment}
          onUpload={handleUpload}
          onDeleteAll={handleDeleteAll}
        />

        <CompanyFilters
          name={name}
          onNameChange={setName}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <CompanyTable
          companies={filteredCompanies}
          total={total}
          loading={loading}
          enrichingCompanies={enrichingCompanies}
          onEnrich={handleEnrich}
        />
      </div>
    </div>
  );
}
