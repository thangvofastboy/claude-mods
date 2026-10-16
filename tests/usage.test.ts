import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { refreshUsage } from '../hooks/register'

// session.usage() hits the rate-limit endpoint: a 429 must back off, not retry every turn.
test('usage refresh is throttled and backs off after a failure', async () => {
  let now = 1_000_000
  let calls = 0
  let fail = true
  const $ = {
    clock: { now: async () => now },
    session: {
      usage: async () => {
        calls++
        if (fail) throw new Error('429')
        return { context: { tokens: 10, percent: 1 }, cost: { usd: 1 }, rateLimits: [] }
      },
    },
    state: {
      get: async () => ({ value: null, version: 0 }),
      set: async () => ({ isSet: true, version: 1 }),
    },
  } as unknown as EngineInterface

  await refreshUsage($)
  expect(calls).toBe(1) // fails -> wait doubles to 60 s
  now += 30_000
  await refreshUsage($)
  expect(calls).toBe(1) // still inside the wait
  fail = false
  now += 31_000
  await refreshUsage($)
  expect(calls).toBe(2) // wait over, succeeds, wait resets to 30 s
  now += 10_000
  await refreshUsage($)
  expect(calls).toBe(2) // throttled
})
