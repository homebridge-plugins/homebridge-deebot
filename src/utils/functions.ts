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

export { parseError, sleep }
