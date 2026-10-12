import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { pollPanes } from '../hooks/register'

// The 3 s poll reads the sessions folder and the agent list only for a pane in front.
test('the poll stays idle until the sessions or activity pane is shown', async () => {
  const asked: string[] = []
  let shown: string[] = []
  const $ = {
    ui: { panes: async () => shown.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) },
    fs: {
      list: async () => (asked.push('fs.list'), []),
    },
    agent: { list: async () => (asked.push('agent.list'), []) },
    session: { id: async () => 'self' },
    state: {
      get: async (ref: { key: string }) => ({ value: ref.key === 'home' ? '/home/x' : undefined, version: 0 }),
      set: async () => ({ isSet: true, version: 1 }),
    },
  } as unknown as EngineInterface

  await pollPanes($)
  expect(asked).toEqual([])

  shown = ['terminal-polish-sessions']
  await pollPanes($)
  expect(asked).toEqual(['fs.list'])

  shown = ['terminal-polish-dash']
  await pollPanes($)
  expect(asked).toEqual(['fs.list', 'agent.list'])
})
