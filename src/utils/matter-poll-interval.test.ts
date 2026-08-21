import { describe, expect, it } from 'vitest'

import { DEFAULT_MATTER_POLL_INTERVAL, matterPollInterval } from './functions.js'

describe('matterPollInterval', () => {
  it('refreshes by default, so a missed event cannot freeze the vacuum for ever', () => {
    // The bug this exists for: with no setting, the Matter vacuum used to poll
    // never at all, and one missed ChargeState left the Home app on
    // "Updating..." until Homebridge was restarted (#309)
    expect(matterPollInterval(undefined)).toBe(DEFAULT_MATTER_POLL_INTERVAL)
    expect(DEFAULT_MATTER_POLL_INTERVAL).toBeGreaterThan(0)
  })

  it('leaves polling off when the user has explicitly asked for none', () => {
    expect(matterPollInterval(0)).toBe(0)
  })

  it('uses the configured interval when there is one', () => {
    expect(matterPollInterval(30)).toBe(30)
    expect(matterPollInterval(600)).toBe(600)
  })

  it('falls back to the default rather than trusting a nonsense value', () => {
    expect(matterPollInterval(Number.NaN)).toBe(DEFAULT_MATTER_POLL_INTERVAL)
    expect(matterPollInterval(-5)).toBe(DEFAULT_MATTER_POLL_INTERVAL)
  })
})
