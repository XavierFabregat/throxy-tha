import { z } from "zod";

export const EMPLOYEE_SIZE_BUCKETS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1,000",
  "1,001-5,000",
  "5,001-10,000",
  "10,000+",
] as const;

export type EmployeeSizeBucket = (typeof EMPLOYEE_SIZE_BUCKETS)[number];

// What we will get in the raw CSV file
export const RawCompanySchema = z
  .object({
    name: z.string().optional(),
    domain: z.string().optional(),
    country: z.string().optional(),
    employee_size: z.string().optional(),
  })
  .passthrough(); // To allow for future expansion of the CSV file

export type RawCompanyData = z.infer<typeof RawCompanySchema>;

// Data after its been cleaned
export interface CleanCompany {
  name: string;
  domain: string | null;
  country: string;
  employee_size: EmployeeSizeBucket;
  raw_json: RawCompanyData;
}

// Possible filters on the API -- we extend them as needed
export const CompanyFiltersSchema = z.object({
  country: z.string().optional(),
  employee_size: z.enum(EMPLOYEE_SIZE_BUCKETS).optional(),
  domain: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type CompanyFilters = z.infer<typeof CompanyFiltersSchema>;
