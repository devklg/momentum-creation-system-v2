import { vi } from 'vitest';

export function stubRequiredEnv(): void {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('JWT_SECRET', 'test-secret-for-persistence-adapter-tests');
}
