import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      SESSION_SECRET: 'test_session_secret_0123456789abcdef0123456789abcdef',
    },
  },
});
