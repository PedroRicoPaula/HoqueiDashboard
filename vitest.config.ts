import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode ?? 'test', process.cwd(), '')
  return {
    test: {
      environment: 'node',
      globals: true,
      env,
      include: ['src/**/*.test.ts'],
      exclude: ['e2e/**', 'node_modules/**'],
      coverage: {
        reporter: ['text', 'lcov'],
        include: ['src/lib/**', 'src/app/api/**'],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
