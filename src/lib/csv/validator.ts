import { RawCompanySchema, type RawCompanyData } from "@/lib/types";

export interface ValidationResult {
  valid: RawCompanyData[];
  invalid: ValidationError[];
}

export interface ValidationError {
  rowIndex: number;
  data: Record<string, string>;
  error: string;
}

export class CSVValidator {
  validate(data: RawCompanyData[]): ValidationResult {
    const valid: RawCompanyData[] = [];
    const invalid: ValidationError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i]!;

      try {
        // Validate against our schema
        const validated = RawCompanySchema.parse(row);
        valid.push(validated);
      } catch (error) {
        invalid.push({
          rowIndex: i + 2, // +2 because we skip header and 0-index
          // this assignment is safe because the only error in this try catch is if the row is not a valid RawCompanyData, which is handled by the catch block, therefore we don't know the shape of the object.
          data: row as Record<string, string>,
          error:
            error instanceof Error ? error.message : "Unknown validation error",
        });
      }
    }

    return { valid, invalid };
  }

  // Additional validation methods for specific business rules
  validateBusinessRules(data: RawCompanyData[]): ValidationError[] {
    const errors: ValidationError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i]!;

      // Business rule: Company must have either name or domain
      if (!row.name && !row.domain) {
        errors.push({
          rowIndex: i + 2,
          data: row as Record<string, string>,
          error: "Company must have either a name or domain",
        });
      }

      // Business rule: Domain format validation (basic)
      if (row.domain && !this.isValidDomain(row.domain)) {
        errors.push({
          rowIndex: i + 2,
          data: row as Record<string, string>,
          error: `Invalid domain format: ${row.domain}`,
        });
      }
    }

    return errors;
  }

  private isValidDomain(domain: string): boolean {
    // Simple domain validation - could be more sophisticated -- regex grabbed online
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain.replace(/^https?:\/\//, ""));
  }
}
