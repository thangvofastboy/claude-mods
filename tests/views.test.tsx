import { expect, mock, test } from 'claude-code/testing'

const PANE_PROPS = {
  isFocused: false,
  bodyColumns: 70,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`settings tab toggles a feature on ${surface}`, async ($, on) => {
    mock.store(on)
    const ui = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'Pane',
      requestId: 'terminal-polish-settings',
      props: { title: 'Cài đặt', ...PANE_PROPS },
    })
    expect((await ui.find({ key: 'set-sound' }))?.text).toContain('○ tắt')
    await ui.press({ key: 'set-sound' })
    expect((await ui.find({ key: 'set-sound' }))?.text).toContain('● bật')
    await ui.unmount()
  })

  test(`long Bash output collapses and opens on press on ${surface}`, async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine output</Text>
    })
    const stdout = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n')
    const ui = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'ToolResult',
      requestId: 'tu_1',
      props: {
        tool_use_id: 'tu_1',
        tool: 'Bash',
        output: { stdout, stderr: '', interrupted: false },
        isErrored: false,
      },
    })
    expect(await ui.find({ type: 'Text', text: 'line 1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'line 4' })).toBeUndefined()
    await ui.press({ key: 'more-tu_1' })
    expect(await ui.find({ type: 'Text', text: 'engine output' })).toBeDefined()
    await ui.unmount()
  })

  test(`tool rows carry a badge on ${surface}`, async $ => {
    const ui = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'ToolUse',
      requestId: 'tu_2',
      props: {
        tool_use_id: 'tu_2',
        tool: 'Bash',
        input: { command: 'ls -la\necho hi' },
        isRunning: false,
        isErrored: false,
        isInterrupted: false,
      },
    })
    expect(await ui.find({ type: 'Text', text: ' Bash ' })).toBeDefined()
    // The whole command shows, every line: a harmless head cannot hide the rest.
    expect(await ui.find({ type: 'Text', text: 'ls -la ⏎ echo hi' })).toBeDefined()
    await ui.unmount()
  })
}

test('Edit rows keep the engine drawing (their diff), not a badge', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine diff</Text>
  })
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 'tu_3',
    props: {
      tool_use_id: 'tu_3',
      tool: 'Edit',
      input: { file_path: '/a/b.ts', old_string: 'x', new_string: 'y' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
    },
  })
  expect(await ui.find({ type: 'Text', text: 'engine diff' })).toBeDefined()
  await ui.unmount()
})

test('"Bật hết" turns every feature on in one write', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'terminal-polish-settings',
    props: { title: 'Cài đặt', ...PANE_PROPS },
  })
  await ui.press({ key: 'all-on' })
  for (const key of ['sound', 'voice', 'autocompact', 'automodel']) {
    expect((await ui.find({ key: `set-${key}` }))?.text).toContain('● bật')
  }
  await ui.unmount()
})

test('the settings tab switches the theme', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'terminal-polish-settings',
    props: { title: 'Cài đặt', ...PANE_PROPS },
  })
  expect((await ui.find({ key: 'theme-auto' }))?.text).toContain('● auto')
  await ui.press({ key: 'theme-dracula' })
  expect((await ui.find({ key: 'theme-dracula' }))?.text).toContain('● dracula')
  await ui.unmount()
})
