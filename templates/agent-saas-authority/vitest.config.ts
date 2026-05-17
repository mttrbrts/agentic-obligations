import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./logic/test-setup.ts'],
  },
});
