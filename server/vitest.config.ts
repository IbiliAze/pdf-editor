import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // bcrypt at cost 12 is deliberately slow; a few auth round trips add up.
    testTimeout: 20000,
    pool: 'forks',
  },
})
