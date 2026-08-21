// Seconds between state refreshes for a Matter vacuum with no setting of
// its own. Matches the placeholder the settings form has always shown.
const DEFAULT_MATTER_POLL_INTERVAL = 120

function parseError(err: Error, hideStack: string[] = []) {
  let toReturn = err.message
  if (err.stack && err.stack.length > 0 && !hideStack.includes(err.message)) {
    const stack = err.stack.split('\n')
    if (stack[1]) {
      toReturn += stack[1].trim()
    }
  }
  return toReturn
}

function sleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000)
  })
}

/**
 * How often a Matter vacuum should ask the robot for its state, in seconds.
 *
 * The Matter clusters are driven entirely by push events from Ecovacs, and a
 * missed one leaves the state frozen - most visibly after docking, where the
 * Home app shows "Updating..." for ever because the Charging event that would
 * move the vacuum off SeekingCharger never arrives (#309). So a Matter vacuum
 * refreshes on a timer unless the user has explicitly turned polling off.
 *
 * The HAP accessories keep their own default of no polling: their switches and
 * sensors are written from more than one event each, so a single missed message
 * does not strand them the way one missed ChargeState strands the vacuum.
 *
 * @param configured the device's `pollInterval` setting, if it has one
 * @returns the interval in seconds, or 0 for no polling at all
 */
function matterPollInterval(configured?: number): number {
  // An explicit 0 means the user asked for no polling, and is left alone
  if (configured === 0) {
    return 0
  }
  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return configured
  }
  return DEFAULT_MATTER_POLL_INTERVAL
}

export { DEFAULT_MATTER_POLL_INTERVAL, matterPollInterval, parseError, sleep }
