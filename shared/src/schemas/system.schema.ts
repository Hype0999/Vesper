import { z } from 'zod';

export const SystemHealthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
  environment: z.string(),
  nodeVersion: z.string(),
  memoryUsageMb: z.object({
    rss: z.number().nonnegative(),
    heapTotal: z.number().nonnegative(),
    heapUsed: z.number().nonnegative(),
  }),
  database: z.object({
    status: z.enum(['ok', 'degraded', 'error']),
    migrationVersion: z.number().int().nonnegative(),
  }),
});

export type SystemHealthValidated = z.infer<typeof SystemHealthSchema>;
