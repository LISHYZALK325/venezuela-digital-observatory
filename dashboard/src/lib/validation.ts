import { z } from 'zod';

// API query parameters validation
export const domainsQuerySchema = z.object({
  status: z.enum(['online', 'offline', 'all']).default('all'),
  ssl: z.enum(['valid', 'invalid', 'none', 'all']).default('all'),
  httpCode: z.enum(['2xx', '3xx', '4xx', '5xx', 'error', 'all']).default('all'),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['domain', 'responseTime', 'checkedAt', 'httpCode', 'status']).default('status'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type DomainsQuery = z.infer<typeof domainsQuerySchema>;

// Trends query parameters
export const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export type TrendsQuery = z.infer<typeof trendsQuerySchema>;

// Export query parameters
export const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  status: z.enum(['online', 'offline', 'all']).default('all'),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;
