import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

// Set up fake IndexedDB before anything else
if (typeof global.indexedDB === 'undefined') {
  global.indexedDB = new IDBFactory()
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Tauri API
global.window = global.window || {}
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))
