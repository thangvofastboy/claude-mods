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

test('the TODO pane adds an item and ticks it off', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'terminal-polish-todo',
    props: { title: 'TODO', ...PANE_PROPS },
  })
  await ui.input({ key: 'todo-new', text: 'viết test cho budget' })
  expect((await ui.find({ key: 'todo-toggle-0' }))?.text).toContain('☐ viết test cho budget')
  await ui.press({ key: 'todo-toggle-0' })
  expect((await ui.find({ key: 'todo-toggle-0' }))?.text).toContain('☑ viết test cho budget')
  await ui.unmount()
})

test('recent tools show short, marked labels and open in full on press', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('tool.call', () => ({ deny: 'test bottom' }))
  on('ui.toast', () => ({ value: undefined }))
  const command = 'pnpm --filter @shop/api run test:integration --reporter=verbose\nrm -rf build'
  await $.tool.call({ tool: 'Bash', command })
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'terminal-polish-dash',
    props: { title: 'Hoạt động', ...PANE_PROPS },
  })
  // Short, but never silently cut: … and the hidden line count are on the row.
  expect(await ui.find({ type: 'Text', text: /Bash {2}pnpm --filter .*… \(\+1 dòng\)/ })).toBeDefined()
  // The opened line (indented) is not drawn yet; the hover card holds the full text by design.
  expect(await ui.find({ type: 'Text', text: /^ {2}pnpm --filter .* ⏎ rm -rf build/ })).toBeUndefined()
  const toggle = await ui.find({ type: 'Button', text: /▸/ })
  expect(toggle).toBeDefined()
  await ui.press({ key: toggle?.key ?? '' })
  expect(await ui.find({ type: 'Text', text: /^ {2}pnpm --filter .* ⏎ rm -rf build/ })).toBeDefined()
  await ui.unmount()
})

test('/mods output draws in color: headings, commands, on/off dots', async $ => {
  const text = [
    'Cách dùng: /mods <lệnh>',
    'Bảng:',
    '  dash      bảng hoạt động',
    'Bật/tắt (giữ qua các session):',
    '  band        [bật] dải trạng thái trên ô prompt',
    '  sound       [tắt] âm thanh khi lượt dài xong',
  ].join('\n')
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'CommandOutput',
    props: { command: 'mods', args: '', text, isErrored: false },
  })
  expect(await ui.find({ type: 'Text', text: '  ● ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  ○ ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ {2}dash/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'dải trạng thái trên ô prompt' })).toBeDefined()
  await ui.unmount()
})
