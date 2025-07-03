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

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Company Data Platform</h1>

      {/* Upload Section */}
      <div
        style={{
          marginBottom: "30px",
          padding: "20px",
          border: "1px solid #ccc",
        }}
      >
        <h2>Upload CSV</h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleUpload}
          disabled={uploadLoading}
        />
        {uploadLoading && <p>Processing...</p>}
      </div>

      {/* Filters */}
      <div
        style={{
          marginBottom: "30px",
          padding: "20px",
          border: "1px solid #ccc",
        }}
      >
        <h2>Filters</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "15px",
          }}
        >
          <div>
            <label>Name:</label>
            <input
              type="text"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "5px", marginTop: "5px" }}
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
              style={{ width: "100%", padding: "5px", marginTop: "5px" }}
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
              style={{ width: "100%", padding: "5px", marginTop: "5px" }}
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
              style={{ width: "100%", padding: "5px", marginTop: "5px" }}
            />
          </div>
        </div>
      </div>

      {/* Results */}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
