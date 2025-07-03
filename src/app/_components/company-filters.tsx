"use client";

import { EMPLOYEE_SIZE_BUCKETS } from "@/lib/types";

interface CompanyFiltersProps {
  name: string;
  onNameChange: (name: string) => void;
  filters: {
    country: string;
    employee_size: string;
    domain: string;
  };
  onFiltersChange: (filters: {
    country: string;
    employee_size: string;
    domain: string;
  }) => void;
}

export function CompanyFilters({
  name,
  onNameChange,
  filters,
  onFiltersChange,
}: CompanyFiltersProps) {
  const updateFilter = (key: keyof typeof filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-col gap-2 border-1 border-t border-b p-2">
      <h2>Filters</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label>Name:</label>
          <input
            type="text"
            placeholder="Enter name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="border-input w-full rounded-md border border-1 p-2"
          />
        </div>
        <div>
          <label>Country:</label>
          <input
            type="text"
            placeholder="Enter country"
            value={filters.country}
            onChange={(e) => updateFilter("country", e.target.value)}
            className="border-input w-full rounded-md border border-1 p-2"
          />
        </div>

        <div>
          <label>Employee Size:</label>
          <select
            value={filters.employee_size}
            onChange={(e) => updateFilter("employee_size", e.target.value)}
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
            onChange={(e) => updateFilter("domain", e.target.value)}
            className="border-input w-full rounded-md border border-1 p-2"
          />
        </div>
      </div>
    </div>
  );
}
