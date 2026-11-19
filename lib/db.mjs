import pg from "pg";

let pool;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("database_not_configured");
  pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    // Use the database provider's verified TLS connection string. Never disable
    // certificate validation to work around a connection error.
  });
  return pool;
}
