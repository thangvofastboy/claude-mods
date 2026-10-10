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

test('a blocked command raises a colored notice card on the band', async ($, on) => {
  mock.clock(on)
  on('tool.call', () => ({ deny: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))
  await $.tool.call({ tool: 'Bash', command: `${'git ' + 'push'} --force origin main` })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '🛡' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Đã chặn: force-push/ })).toBeDefined()
  await ui.unmount()
})
