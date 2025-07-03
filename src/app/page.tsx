"use client";

import { useState, useEffect } from "react";
import { type Company } from "@/server/db/schema";
import { EMPLOYEE_SIZE_BUCKETS } from "@/lib/types";

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
  const [filters, setFilters] = useState({
    country: "",
    employee_size: "",
    domain: "",
  });

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
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #ccc",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ccc",
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ccc",
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ccc",
                  }}
                >
                  Domain
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ccc",
                  }}
                >
                  Country
                </th>
                <th
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    border: "1px solid #ccc",
                  }}
                >
                  Employee Size
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      border: "1px solid #ccc",
                    }}
                  >
                    No companies found
                  </td>
                </tr>
              ) : (
                companies.map((company, index) => (
                  <tr key={company.id}>
                    <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                      {company.name}
                    </td>
                    <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                      {company.domain ?? "-"}
                    </td>
                    <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                      {company.country}
                    </td>
                    <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                      {company.employee_size}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
