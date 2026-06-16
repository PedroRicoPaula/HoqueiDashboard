const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) console.warn(`[WARN] ${message}`, ...args)
  },
  info: (message: string, ...args: unknown[]) => {
    if (isDev) console.log(`[INFO] ${message}`, ...args)
  },
}
