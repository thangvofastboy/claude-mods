import { expect, test } from 'claude-code/testing'
import { agentSummary } from '../hooks/register'

test('agent counts group the statuses the pane and band show', () => {
  const list = ['running', 'pending', 'waiting', 'idle', 'completed', 'completed', 'failed', 'killed'].map(status => ({
    status,
  }))
  expect(agentSummary(list)).toEqual({ running: 3, done: 2, failed: 2, total: 8 })
  expect(agentSummary([])).toEqual({ running: 0, done: 0, failed: 0, total: 0 })
})
