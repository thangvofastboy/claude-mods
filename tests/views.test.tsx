import { expect, mock, test } from 'claude-code/testing'
import { changelogOf, codeBlocks, editDiff, linksOf, usdOf, vagueHint } from '../hooks/register'

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
    expect((await ui.find({ key: 'dot-sound' }))?.text).toContain('○')
    await ui.press({ key: 'set-sound' })
    expect((await ui.find({ key: 'dot-sound' }))?.text).toContain('◉')
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
  for (const key of ['sound', 'voice', 'autocompact', 'powerline']) {
    expect((await ui.find({ key: `dot-${key}` }))?.text).toContain('◉')
  }
  // Experimental: never switched on in bulk.
  expect((await ui.find({ key: 'dot-automodel' }))?.text).toContain('○')
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
  expect((await ui.find({ key: 'theme-auto' }))?.text).toContain('auto  (đang dùng)')
  await ui.press({ key: 'theme-dracula' })
  expect((await ui.find({ key: 'theme-dracula' }))?.text).toContain('dracula  (đang dùng)')
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
  // This test is about the row's label; held commands (blast) have their own test.
  await $.command.run({ command: 'mods', args: 'blast', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  const command = 'pnpm --filter @shop/api run test:integration --reporter=verbose\nrm -rf build'
  await $.tool.call({ tool: 'Bash', command })
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'terminal-polish-dash',
    props: { title: 'Hoạt động', ...PANE_PROPS },
  })
  // Short, but never silently cut: … and the hidden line count sit on the row in
  // their own element, so a narrow pane truncates the label and keeps them.
  expect(await ui.find({ type: 'Text', text: /^✗ Bash {2}pnpm --filter/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '… (+1 dòng)' })).toBeDefined()
  // Details are drawn only once the row is opened.
  expect(await ui.find({ type: 'Text', text: /pnpm --filter .* ⏎ rm -rf build/ })).toBeUndefined()
  const toggle = await ui.find({ type: 'Button', text: /▸/ })
  expect(toggle).toBeDefined()
  await ui.press({ key: toggle?.key ?? '' })
  expect(await ui.find({ type: 'Text', text: /pnpm --filter .* ⏎ rm -rf build/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Bash · lỗi/ })).toBeDefined()
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

test('/mods theme navy switches to the navy palette and suggests its background', async ($, on) => {
  mock.store(on)
  const ran = await $.command.run({
    command: 'mods',
    args: 'theme navy',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(ran.text).toContain('Đã đổi theme: navy')
  expect(ran.text).toContain('#0b1426')
})

// compact puts the gauges on the status line; off, they get a line of their own.
test('compact draws the band on one status row', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const run = (args: string) =>
    $.command.run({ command: 'mods', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  const band = {
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 19 }, view: {} },
  } as const
  // The row whose own children say "sẵn sàng": does it also hold the budget gauge?
  type Node = { type?: string; children?: unknown }
  const kids = (n: Node): Node[] => [n.children].flat(Infinity).filter(x => x && typeof x === 'object') as Node[]
  const text = (n: unknown): string =>
    typeof n === 'string' ? n : n && typeof n === 'object' ? [(n as Node).children].flat(Infinity).map(text).join('') : ''
  const statusRow = (n: Node): Node | undefined =>
    kids(n).some(k => k.type === 'Text' && text(k) === 'sẵn sàng') ? n : kids(n).map(statusRow).find(Boolean)
  const gaugeOnStatusRow = async () => {
    const ui = await $.ui.mount(band)
    const tree = (await ui.drawn()) as Node
    await ui.unmount()
    return text(statusRow(tree)).includes('💰')
  }

  await run('budget 5')
  expect(await gaugeOnStatusRow()).toBe(false)
  expect((await run('compact')).text).toContain('BẬT')
  expect(await gaugeOnStatusRow()).toBe(true)
})

// With frame off, a prompt card is a rounded bracket: ╭ on the first line, │ between, ╰ on the last; one line is ╰.
test('frame off draws a rounded bracket down the left', async ($, on) => {
  mock.store(on)
  const mods = (args: string) =>
    $.command.run({ command: 'mods', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect((await mods('frame')).text).toContain('TẮT')
  const edges = async (text: string) => {
    const ui = await $.ui.mount({
      plugin: 'terminal-polish',
      surface: 'terminal',
      component: 'UserMessage',
      props: { text, origin: { kind: 'composer' }, isExpanded: false },
    })
    const found = (await ui.findAll({ type: 'Text', text: /^[╭│╰] $/ })).map(t => t.text)
    expect((await ui.findAll({ type: 'Box' })).some(b => b.props.borderStyle === 'round')).toBe(false)
    await ui.unmount()
    return found
  }
  expect(await edges('một\nhai\nba')).toEqual(['╭ ', '│ ', '╰ '])
  expect(await edges('một dòng')).toEqual(['╰ '])
})

// The frame setting boxes the whole prompt in a rounded border and drops the bracket glyphs inside it.
test('a prompt in a frame has no bracket glyphs and keeps its text', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'UserMessage',
    props: { text: 'một\nhai', origin: { kind: 'composer' }, isExpanded: false },
  })
  expect(await ui.findAll({ type: 'Text', text: /^[╭│╰] $/ })).toEqual([])
  expect(await ui.find({ type: 'Text', text: /một/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Box' })).some(b => b.props.borderStyle === 'round')).toBe(true)
  await ui.unmount()
})

// Message actions are colored icons only; the words stay as the buttons' names.
test('a sent prompt shows the copy icon with a short English word, not its label', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'UserMessage',
    requestId: 'r1',
    props: { text: 'xin chào', origin: { kind: 'composer' }, isExpanded: false },
  })
  expect((await ui.find({ key: 'copy-r1' }))?.text).toBe('📋 Copy ')
  expect((await ui.find({ key: 'save-r1' }))?.text).toBe('⭐ Save ')
  expect(await ui.findAll({ type: 'Text', text: /Sao chép/ })).toEqual([])
  await ui.unmount()
})

test('each fenced block of a reply gets its own copy button', async ($, on) => {
  mock.store(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine reply</Text>
  })
  const text = 'Chạy này:\n```ts\nconst a = 1\n```\nrồi này:\n```\nls\n```'
  expect(codeBlocks(text)).toEqual([
    { lang: 'ts', code: 'const a = 1' },
    { lang: '', code: 'ls' },
  ])
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'a1',
    props: { text, isFirstOfReply: true },
  })
  expect(await ui.find({ key: 'code-a1-0' })).toBeDefined()
  expect(await ui.find({ key: 'code-a1-1' })).toBeDefined()
  await ui.unmount()
})

test('a reply lists its links and backticked files, skipping code blocks', () => {
  const text = 'Xem https://example.com/a?b=1. và `hooks/register.tsx:42`, `~/x.md`.\n```\nhttps://inside.dev `no.ts`\n```'
  expect(linksOf(text)).toEqual(['https://example.com/a?b=1', 'hooks/register.tsx', '~/x.md'])
  expect(linksOf('**https://x.dev/y**')).toEqual(['https://x.dev/y'])
})

test('a scene theme draws its animated strip on desktop only', async ($, on) => {
  mock.store(on)
  await $.command.run({
    command: 'mods',
    args: 'theme thaicuc',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  const band = {
    plugin: 'terminal-polish',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  } as const
  const desk = await $.ui.mount({ ...band, surface: 'desktop' })
  const svg = await desk.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  await desk.unmount()
  const term = await $.ui.mount({ ...band, surface: 'terminal' })
  expect(await term.find({ type: 'Svg' })).toBeUndefined()
  await term.unmount()
})

test('/mods accounts lists claude-swap profiles and switches through /profile', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const calls: string[] = []
  let active = 'work'
  on('command.run', { command: 'profile' }, (_$, e) => {
    calls.push(e.args)
    if (e.args === 'list --json') {
      return {
        text: JSON.stringify({
          active,
          profiles: ['work', 'home'].map(name => ({ name, active: name === active, email: `${name}@x.io`, tags: [], disabled: false })),
        }),
      }
    }
    active = e.args.replace('swap ', '')
    return { text: `🔀 ${active}` }
  })
  const run = (args: string) =>
    $.command.run({ command: 'mods', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  await run('accounts')
  await clock.advance(500)
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'terminal-polish-accounts',
    props: { title: 'Tài khoản Claude', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: 'home@x.io' })).toBeDefined()
  await ui.press({ key: 'acc-use-1' })
  expect(calls).toContain('swap home')
  expect(active).toBe('home')
  await ui.unmount()

  expect((await run('accounts --force')).text).toContain('không hợp lệ')
})

test('/mods clear empties the prompt box', async ($, on) => {
  mock.store(on)
  const fills: string[] = []
  on('prompt.fill', (_$, e) => {
    fills.push(e.text)
    return { isFilled: true } as never
  })
  const ran = await $.command.run({ command: 'mods', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(fills).toEqual([''])
  expect(ran.text).toContain('Đã xoá')
})

test('the band has a clear icon that empties the prompt box', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const fills: string[] = []
  on('prompt.fill', (_$, e) => {
    fills.push(e.text)
    return { isFilled: true } as never
  })
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  await ui.press({ key: 'clear' })
  expect(fills).toEqual([''])
  await ui.unmount()
})

test('the band account button opens the accounts pane with the profiles loaded', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  on('command.run', { command: 'profile' }, () => ({
    text: JSON.stringify({ active: 'work', profiles: [{ name: 'work', active: true, email: null, tags: [], disabled: false }] }),
  }))
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  await ui.press({ key: 'accounts' })
  expect(opened).toContain('terminal-polish-accounts')
  expect((await ui.find({ key: 'accounts' }))?.text).toContain('👤 work')
  await ui.unmount()
})

test('replay diffs keep one line of context and cap long steps', () => {
  const edit = editDiff('a\nb\nc\nd\ne', 'a\nb\nX\nd\ne')
  expect(edit).toEqual({ diff: '⋯\n b\n-c\n+X\n d\n⋯', added: 1, removed: 1 })
  const created = editDiff('', Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n'))
  expect(created.added).toBe(20)
  expect(created.diff.split('\n')).toHaveLength(13)
  expect(created.diff).toContain('… 8 dòng nữa')
})

test('/mods replay says so when no turn has edited files', async ($, on) => {
  mock.store(on)
  const ran = await $.command.run({ command: 'mods', args: 'replay', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(ran.text).toContain('Chưa có lượt nào')
})

test('prompt lint flags short pointing prompts only', () => {
  expect(vagueHint('sửa cái này đi')).not.toBeNull()
  expect(vagueHint('fix it')).not.toBeNull()
  expect(vagueHint('fix it in `band.tsx`')).toBeNull()
  expect(vagueHint('commit, push, danh tag')).toBeNull()
  expect(vagueHint('/mods replay')).toBeNull()
})

test('changelog groups today by commit type and skips releases', () => {
  const text = changelogOf(['feat: replay pane', 'fix(band): spacing', 'chore: release v0.15.0', 'docs: readme'], '2026-10-30')
  expect(text).toBe('## 2026-10-30\n\n### Tính năng\n- replay pane\n\n### Sửa lỗi\n- spacing\n\n### Khác\n- docs: readme')
  expect(changelogOf(['chore: release v1.0.0'], 'x')).toBeNull()
})

test('usdOf prices a response by its model', () => {
  const u = { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  expect(usdOf('claude-opus-5-5', u)).toBe(24)
  expect(usdOf('claude-sonnet-5-5', u)).toBe(12)
  expect(usdOf('unknown-model', u)).toBe(0)
})

test('the AI monitor shows each agent loop with model, effort, tokens and cost', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const usage = { model: 'claude-sonnet-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 }
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage } as never
  })
  const step = async (agentId?: string) => {
    const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-sonnet-5-5', effort: 'medium', messageCount: 1, ...(agentId ? { agentId } : {}) } as never)
    for await (const _ of stream as AsyncIterable<unknown>) void _
  }
  await step()
  await step('a1')
  await step('a1')
  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'terminal-polish-monitor',
    props: { title: 'AI monitor', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(texts).toContain('Main')
  expect(texts).toContain('sonnet-5-5 · medium')
  expect(texts).toContain('2 lần gọi')
  expect(texts).toContain('ctx 3.0k')
  await ui.unmount()
})

test('a turn that edits a file publishes a replay with its diff', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', () => ({ result: { ok: true } }) as never)
  on('ui.toast', () => ({ value: undefined }))
  await $.turn.start({ turnId: 't1', text: 'đổi tên' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/tmp/x.ts', old_string: 'const a = 1', new_string: 'const b = 1' } as never)
  await $.turn.complete({ turnId: 't1', answer: 'xong', durationMs: 10, isAborted: false, reason: 'answer', text: 'đổi tên' } as never)
  const band = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  expect((await band.find({ key: 'replay' }))?.text).toContain('Replay 1')
  await band.unmount()
})
