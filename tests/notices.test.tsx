import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'terminal-polish',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

// The ask itself waits on the permission dialog, which no test can answer; a
// bare query (another plugin's $.tool.check, no tool_use_id) is answered but
// must not toast a notice for a call that never runs.
test('a permission query is put to the person without a notice card', async ($, on) => {
  mock.clock(on)
  on('tool.check', () => ({ decision: 'allow', reason: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))
  const verdict = await $.tool.check({ tool: 'Bash', input: { command: `${'git ' + 'push'} --force origin main` } })
  expect(verdict.decision).toBe('ask')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Cần duyệt/ })).toBeUndefined()
  await ui.unmount()
})
