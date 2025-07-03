import type { RawCompanyData } from "@/lib/types";

export interface CSVParseResult {
  data: RawCompanyData[];
  warnings: string[];
}

export interface CSVParseOptions {
  skipEmptyLines?: boolean;
  trimFields?: boolean;
}

export class CSVParser {
  private readonly options: Required<CSVParseOptions>;

  constructor(options: CSVParseOptions = {}) {
    this.options = {
      skipEmptyLines: options.skipEmptyLines ?? true,
      trimFields: options.trimFields ?? true,
    };
  }

  parse(csvData: string): CSVParseResult {
    const warnings: string[] = [];

    // Step 1: Basic validation and preprocessing
    const lines = this.preprocessLines(csvData);
    this.validateBasicStructure(lines);

    // Step 3: Parse headers -- bang operator is safe because we validated the structure above and will have error if it's not there
    const headers = this.parseHeaders(lines[0]!);

    // Step 4: Parse data rows
    const rawRows = this.parseDataRows(lines.slice(1), warnings);

    // Step 5: Transform to structured data
    const data = this.transformToObjects(rawRows, headers, warnings);

    return { data, warnings };
  }

  private preprocessLines(csvData: string): string[] {
    const lines = csvData.split("\n");

    if (this.options.skipEmptyLines) {
      return lines.filter((line) => line.trim().length > 0);
    }

    return lines;
  }

  private validateBasicStructure(lines: string[]): void {
    if (lines.length < 1) {
      throw new Error("CSV is empty");
    }

    if (lines.length < 2) {
      throw new Error("CSV must have at least a header and one data row");
    }
  }

  private parseHeaders(headerLine: string): string[] {
    const rawHeaders = this.parseCSVLine(headerLine);
    return rawHeaders.map((header) => this.normalizeHeader(header));
  }

  private parseDataRows(dataLines: string[], warnings: string[]): string[][] {
    const rows: string[][] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i]!;

      if (this.options.skipEmptyLines && line.trim().length === 0) {
        continue;
      }

      try {
        const values = this.parseCSVLine(line);
        rows.push(values);
      } catch (error) {
        warnings.push(
          `Row ${i + 2}: Failed to parse - ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return rows;
  }

  private transformToObjects(
    rows: string[][],
    headers: string[],
    warnings: string[],
  ): RawCompanyData[] {
    const objects: RawCompanyData[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const obj: Record<string, string> = {};

      // Handle rows with different column counts -- this is a warning because it's not a critical error, but it's something to be aware of
      if (row.length !== headers.length) {
        warnings.push(
          `Row ${i + 2}: Expected ${headers.length} columns, got ${row.length}`,
        );
      }

      headers.forEach((header, index) => {
        obj[header] = this.options.trimFields
          ? (row[index] ?? "").trim()
          : (row[index] ?? "");
      });

      objects.push(obj);
    }

    return objects;
  }

  private normalizeHeader(header: string): string {
    const normalized = header.toLowerCase().trim();

    // DESIGN DECISION: Flexible header mapping for common variations
    // This allows CSVs with different header names to work
    // For the current approach we only need to map the headers to the ones we need, but if we wanted to be more flexible we could map the headers to a more generic name and then map the generic name to the actual name in the database
    const headerMap: Record<string, string> = {
      // Company name variations
      company_name: "name",
      // add any other variations of company name here

      // Domain variations
      domain: "domain",
      // add any other variations of domain here

      // Employee size variations
      employee_size: "employee_size",
      // add any other variations of employee size here
    };

    return headerMap[normalized] ?? normalized;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";

    // More robust parsing of CSV line that lets us handle quoted fields, not really needed for the cuurent task but gives the code more flexibility for future use cases
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);

    // Clean up quoted fields
    return result.map((field) => field.replace(/^"|"$/g, ""));
  }
}
