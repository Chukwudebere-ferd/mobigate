import * as React from 'react'

/**
 * A stable "current time" for the lifetime of the component.
 *
 * Reading the clock during render is impure: it can produce a different
 * answer on every render, which the React Compiler rejects and which makes
 * "upcoming vs. past" comparisons flicker. This hook samples the clock once
 * and refreshes it on an interval, so the value is stable between renders
 * and still ticks while the page is open.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
