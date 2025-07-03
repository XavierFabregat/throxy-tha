"use client";

import { type Company } from "@/server/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import EnrichDialog from "./enrich-dialog";

interface CompanyTableProps {
  companies: Company[];
  total: number;
  loading: boolean;
  enrichingCompanies: Set<string>;
  onEnrich: (companyId: string) => void;
}

export function CompanyTable({
  companies,
  total,
  loading,
  enrichingCompanies,
  onEnrich,
}: CompanyTableProps) {
  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h2>Companies ({total} total)</h2>
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
          {companies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center">
                No companies found
              </TableCell>
            </TableRow>
          ) : (
            companies.map((company, index) => (
              <CompanyRow
                key={company.id}
                company={company}
                index={index}
                isEnriching={enrichingCompanies.has(company.id)}
                onEnrich={onEnrich}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface CompanyRowProps {
  company: Company;
  index: number;
  isEnriching: boolean;
  onEnrich: (companyId: string) => void;
}

function CompanyRow({
  company,
  index,
  isEnriching,
  onEnrich,
}: CompanyRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{index + 1}</TableCell>
      <TableCell className="font-medium">{company.name}</TableCell>
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
            <EnrichDialog company={company} handleEnrich={onEnrich} />
          </Dialog>
        ) : (
          <button
            onClick={() => onEnrich(company.id)}
            disabled={isEnriching}
            className="inline-flex cursor-pointer items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200 disabled:opacity-50"
          >
            {isEnriching ? "Enriching..." : "Enrich"}
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}
