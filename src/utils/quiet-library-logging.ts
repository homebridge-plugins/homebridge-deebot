import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)

/**
 * The `ecovacs-deebot` library prints every MQTT event it receives straight to
 * the console, unconditionally. In a Homebridge install that fills the log with
 * raw robot payloads that mean nothing to a user.
 *
 * This used to be handled with patch-package and a `postinstall` hook, which
 * meant every user's install ran a lifecycle script that rewrote files inside
 * their `node_modules`. That is the wrong place to fix a logging preference, so
 * the same gate is now applied at runtime instead.
 *
 * ⚠️ This only works because the library calls the logger through the module
 * object - `tools.logEvent(command, payload)` in
 * `library/950type/ecovacsMQTT_JSON.js` - so reassigning the export is seen at
 * call time. A direct local call inside `tools.js` would NOT be affected, which
 * is exactly how the newer alpha library invokes its own internal tracing. Check
 * the call site before assuming an override like this takes effect.
 *
 * `ecovacs-deebot-alpha` needs nothing here. Upstream already made this change:
 * its dispatcher calls `tools.envLogEvent()` (`ecovacsMessageDispatcher.js:212`),
 * which is gated on `NODE_ENV` via `verbose()`. Its unconditional `logEvent` is
 * exported but never called from outside `tools.js`, so the patch we used to
 * carry for it was rewriting a function nothing reached.
 */

/**
 * Whether the library's event logging should be let through. Matches the
 * behaviour the old patch applied, so nothing changes for anyone who was
 * relying on it.
 */
export function isLibraryLoggingEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development' || nodeEnv === 'dev'
}

interface EcovacsTools {
  logEvent?: (event: string, value: unknown) => void
  __eventLogGated?: boolean
}

/**
 * Wrap `logEvent` on a library tools module so it only logs in development.
 *
 * Returns false when there is nothing to wrap - if a future library version
 * renames or stops exporting `logEvent`, the caller can say so rather than
 * leaving the spam to reappear silently.
 */
export function applyEventLogGate(tools: EcovacsTools): boolean {
  if (typeof tools.logEvent !== 'function') {
    return false
  }

  // Applying twice would nest the wrappers - harmless, but pointless, and it
  // would make the behaviour harder to reason about if this is ever called
  // from more than one place.
  if (tools.__eventLogGated) {
    return true
  }

  const original = tools.logEvent
  tools.logEvent = (event: string, value: unknown) => {
    if (isLibraryLoggingEnabled(process.env.NODE_ENV)) {
      original(event, value)
    }
  }
  tools.__eventLogGated = true

  return true
}

/**
 * Apply the gate to the installed `ecovacs-deebot` library.
 *
 * Returns false if the library or its logger could not be found, so the caller
 * can log that rather than assume it worked.
 */
export function quietEcovacsEventLogging(): boolean {
  try {
    return applyEventLogGate(require('ecovacs-deebot/library/tools.js'))
  } catch {
    return false
  }
}
