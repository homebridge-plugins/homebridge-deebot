import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEventLogGate, isLibraryLoggingEnabled } from './quiet-library-logging.js'

/**
 * These replace a patch-package patch that used to be applied to the user's
 * node_modules by a postinstall hook. The behaviour must stay identical to that
 * patch - silent normally, logging only under NODE_ENV development/dev.
 */

describe('isLibraryLoggingEnabled', () => {
  it('lets logging through in development', () => {
    expect(isLibraryLoggingEnabled('development')).toBe(true)
    expect(isLibraryLoggingEnabled('dev')).toBe(true)
  })

  it('stays quiet everywhere else', () => {
    expect(isLibraryLoggingEnabled(undefined)).toBe(false)
    expect(isLibraryLoggingEnabled('')).toBe(false)
    expect(isLibraryLoggingEnabled('production')).toBe(false)
    // Guard against a loose check creeping in - these are not the dev values.
    expect(isLibraryLoggingEnabled('Development')).toBe(false)
    expect(isLibraryLoggingEnabled('developmentish')).toBe(false)
  })
})

describe('applyEventLogGate', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('reports failure when there is no logger to wrap', () => {
    // If a future library version renames or drops logEvent, the caller needs
    // to know - otherwise the log spam returns silently.
    expect(applyEventLogGate({})).toBe(false)
    expect(applyEventLogGate({ logEvent: undefined })).toBe(false)
    expect(applyEventLogGate({ logEvent: 'not a function' as unknown as () => void })).toBe(false)
  })

  it('suppresses the library logger by default', () => {
    const logEvent = vi.fn()
    const tools = { logEvent }

    expect(applyEventLogGate(tools)).toBe(true)

    tools.logEvent('SomeEvent', { payload: true })
    expect(logEvent).not.toHaveBeenCalled()
  })

  it('lets the library log in development, passing the arguments straight through', () => {
    const logEvent = vi.fn()
    const tools = { logEvent }
    applyEventLogGate(tools)

    process.env.NODE_ENV = 'dev'
    tools.logEvent('SomeEvent', { payload: true })

    expect(logEvent).toHaveBeenCalledExactlyOnceWith('SomeEvent', { payload: true })
  })

  it('decides per call, not once at startup', () => {
    // The gate reads NODE_ENV when the event fires. Capturing it at wrap time
    // would make the behaviour depend on module load order.
    const logEvent = vi.fn()
    const tools = { logEvent }
    applyEventLogGate(tools)

    tools.logEvent('Quiet', 1)
    process.env.NODE_ENV = 'development'
    tools.logEvent('Loud', 2)
    delete process.env.NODE_ENV
    tools.logEvent('QuietAgain', 3)

    expect(logEvent).toHaveBeenCalledExactlyOnceWith('Loud', 2)
  })

  it('does not wrap twice when applied again', () => {
    const logEvent = vi.fn()
    const tools = { logEvent }

    applyEventLogGate(tools)
    const afterFirst = tools.logEvent
    expect(applyEventLogGate(tools)).toBe(true)

    expect(tools.logEvent).toBe(afterFirst)
  })
})
