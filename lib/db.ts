import { neon } from '@neondatabase/serverless';

// Serverless-compatible database connection
export const sql = neon(process.env.DATABASE_URL!);

// Helper to run queries
export async function query<T = any>(queryText: string, params?: any[]): Promise<T[]> {
  try {
    const result = await sql(queryText, params);
    return result as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
