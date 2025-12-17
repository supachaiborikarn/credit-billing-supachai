import { vi } from 'vitest'

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Mock console methods if needed
// vi.spyOn(console, 'log').mockImplementation(() => {})
// vi.spyOn(console, 'error').mockImplementation(() => {})
