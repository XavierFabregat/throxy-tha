// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `take-home-task_${name}`);

export const companies = createTable(
  "company",
  (t) => ({
    id: t
      .varchar({ length: 256 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: t.varchar({ length: 256 }).notNull(),
    domain: t.varchar({ length: 256 }), // nullable for missing domains since it can be blank -- we can fill data with AI calls
    country: t.varchar({ length: 100 }),
    employee_size: t.varchar({ length: 50 }).notNull(),
    raw_json: t.jsonb().notNull(), // Store original CSV data for auditability and possible duplication handling
    created_at: t
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_at: t.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("company_country_idx").on(t.country),
    index("company_employee_size_idx").on(t.employee_size),
    index("company_domain_idx").on(t.domain),
  ],
);

// Types for the application
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
