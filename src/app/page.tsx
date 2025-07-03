"use client";

import { useState, useEffect, useMemo } from "react";
import { type Company } from "@/server/db/schema";
import { EMPLOYEE_SIZE_BUCKETS } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EnrichDialog from "./_components/enrich-dialog";
import { Dialog, DialogTrigger } from "../components/ui/dialog";
import { Button } from "../components/ui/button";

interface CompaniesResponse {
  companies: Company[];
  total: number;
}

interface UploadResult {
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetails: string[];
  totalCost?: number;
}

export default function HomePage() {
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

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) =>
      company.name.toLowerCase().includes(name.toLowerCase()),
    );
  }, [companies, name]);

  const fetchCompanies = async () => {
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
  };

  useEffect(() => {
    void fetchCompanies();
  }, [filters]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as UploadResult;

      if (response.ok) {
        alert(
          `Upload completed!\nProcessed: ${result.processed}\nInserted: ${result.inserted}\nUpdated: ${result.updated}\nErrors: ${result.errors}`,
        );
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
        void fetchCompanies(); // Refresh the data
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

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex h-full w-full flex-col gap-4">
        <h1 className="text-2xl font-bold">Company Data Platform</h1>
        <div className="flex w-full items-center justify-between gap-4 border-1 border-t border-b p-2">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Upload CSV</h2>
            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              disabled={uploadLoading}
              className="border-input w-full rounded-md border border-1 p-2"
            />
            {uploadLoading && <p>Processing...</p>}
          </div>

          <Button
            variant="destructive"
            onClick={() => {
              void fetch("/api/companies", {
                method: "DELETE",
              }).then(() => {
                alert("All companies deleted");
                void fetchCompanies();
              });
            }}
          >
            Delete All Companies
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-1 border-t border-b p-2">
          <h2>Filters</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>Name:</label>
              <input
                type="text"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-input w-full rounded-md border border-1 p-2"
              />
            </div>
            <div>
              <label>Country:</label>
              <input
                type="text"
                placeholder="Enter country"
                value={filters.country}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, country: e.target.value }))
                }
                className="border-input w-full rounded-md border border-1 p-2"
              />
            </div>

            <div>
              <label>Employee Size:</label>
              <select
                value={filters.employee_size}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    employee_size: e.target.value,
                  }))
                }
                className="border-input w-full rounded-md border p-2"
              >
                <option value="">All Sizes</option>
                {EMPLOYEE_SIZE_BUCKETS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Domain:</label>
              <input
                type="text"
                placeholder="Enter domain"
                value={filters.domain}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, domain: e.target.value }))
                }
                className="border-input w-full rounded-md border border-1 p-2"
              />
            </div>
          </div>
        </div>

        <div>
          <h2>Companies ({total} total)</h2>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Employee Size</TableHead>
                  <TableHead>Enrichment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      No companies found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company, index) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {company.name}
                      </TableCell>
                      <TableCell>
                        {company.domain ? (
                          <a
                            href={`https://${company.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {company.domain}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>{company.country}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                          {company.employee_size}
                        </span>
                      </TableCell>
                      <TableCell>
                        {company.enrichment_data ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <span className="inline-flex cursor-pointer items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                Enriched
                              </span>
                            </DialogTrigger>
                            <EnrichDialog
                              company={company}
                              handleEnrich={handleEnrich}
                            />
                          </Dialog>
                        ) : (
                          <button
                            onClick={() => handleEnrich(company.id)}
                            disabled={enrichingCompanies.has(company.id)}
                            className="inline-flex cursor-pointer items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200 disabled:opacity-50"
                          >
                            {enrichingCompanies.has(company.id)
                              ? "Enriching..."
                              : "Enrich"}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
