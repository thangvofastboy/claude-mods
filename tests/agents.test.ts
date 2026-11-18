import { expect, mock, test } from 'claude-code/testing'
import { activityOf, agentIcon, agentSummary, ascii, crewFrame, heroMove, heroName, liveOf, spark8, tokenRate, toolLabel, toolIcon, meter, toolMix, durSpark, settleCalls, callsByAgent } from '../hooks/register'

test('agent counts group the statuses the pane and band show', () => {
  const list = ['running', 'pending', 'waiting', 'idle', 'completed', 'completed', 'failed', 'killed'].map(status => ({
    status,
  }))
  expect(agentSummary(list)).toEqual({ running: 3, done: 2, failed: 2, total: 8 })
  expect(agentSummary([])).toEqual({ running: 0, done: 0, failed: 0, total: 0 })
})

const agent = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  description: `task ${id}`,
  type: 'Explore',
  status: 'running',
  kind: 'local_agent',
  taskStatus: 'running',
  label: `\nĐang đọc ${id}.ts\nmore`,
  startTime: 1_000,
  cwd: '/repo',
  model: 'claude-haiku-5-5',
  effort: 'low',
  contextWindowSize: 200_000,
  tokenCount: 20_000,
  tokenSamples: [0, 5_000, 12_000, 20_000],
  cost: { usd: 0.0123 },
  hasRow: true,
  ...over,
})

test('a listed agent maps to what the monitor draws', () => {
  expect(liveOf(agent('a1') as never)).toEqual({
    id: 'a1',
    model: 'claude-haiku-5-5',
    effort: 'low',
    startTime: 1_000,
    tokens: 20_000,
    ctx: 200_000,
    samples: [0, 5_000, 12_000, 20_000],
    usd: 0.0123,
    doing: 'Đang đọc a1.ts',
  })
  expect(tokenRate([0, 5_000, 12_000, 20_000])).toBe(1_600)
  expect(tokenRate([10, 4])).toBe(0)
  expect(tokenRate([])).toBe(0)
  expect(spark8([0, 5, 12, 20])).toBe('▅▇█')
  expect(spark8([7])).toBe('')
})

test('a crew frame fills one row per lane and keeps model text out of the cells', () => {
  const lanes = [
    { tag: '#1 Explore', color: '#ff8800', rate: 0 },
    { tag: '#2 tìm 🚀', color: '#00ff88', rate: 500 },
  ]
  const words = new Uint32Array(Uint8Array.from(atob(crewFrame(lanes, 3, 40, { muted: '#5c5c5c' })), c => c.charCodeAt(0)).buffer)
  expect(words.length).toBe(2 * 40 * 3)
  const glyphs = Array.from({ length: words.length / 3 }, (_, i) => words[i * 3] ?? 0)
  expect(glyphs.every(g => g >= 0x20 && g <= 0xffff && g !== 0x1f680)).toBe(true)
  const row2 = String.fromCharCode(...glyphs.slice(40, 40 + 23))
  expect(row2.slice(2)).toBe('#2 t?m ??'.padEnd(21))
  // A pane narrower than the tag still gives rows of exactly its width.
  expect(atob(crewFrame(lanes, 0, 20, { muted: '#5c5c5c' })).length).toBe(2 * 20 * 12)
  // Every lane shows its comet head once.
  expect(glyphs.slice(0, 40).filter(g => g === 0x25cf).length).toBe(1)
  expect(glyphs.slice(40).filter(g => g === 0x25cf).length).toBe(1)
})

test('two agents at once open the monitor, once per burst', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  let listed = [agent('a1')]
  const opened: string[] = []
  on('agent.list', () => ({ value: listed }) as never)
  on('agent.spawn', () => ({ agentId: 'x', model: 'claude-haiku-5-5' }) as never)
  on('ui.open', (_$, e) => (opened.push(e.id), { value: { isPlaced: true } }) as never)
  const spawn = () => $.agent.spawn({ prompt: 'p', description: 'd', subagentType: 'Explore', model: 'haiku' } as never)
  await spawn()
  await clock.advance(10)
  expect(opened).toEqual([])
  listed = [agent('a1'), agent('a2')]
  await spawn()
  await clock.advance(10)
  expect(opened).toEqual(['terminal-polish-monitor'])
  listed = [agent('a1'), agent('a2'), agent('a3')]
  await spawn()
  await clock.advance(10)
  expect(opened).toEqual(['terminal-polish-monitor'])

  const ui = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'terminal-polish-monitor',
    props: { title: 'AI monitor', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(texts).toContain('3 agent đang chạy')
  expect(texts).toContain('#2 Dương Quá')
  expect(texts).toContain('◆ haiku-5-5')
  expect(texts).toContain('20.0k tok')
  expect(texts).not.toContain('% ctx')
  expect(texts).toContain('⤷ Đang đọc a3.ts')
  expect(await ui.findAll({ type: 'Raster' })).toHaveLength(1)
  await ui.unmount()

  // a1 finishes: it leaves the pane, the others keep their numbers.
  listed = [agent('a1', { status: 'completed' }), agent('a2'), agent('a3')]
  const shot = async () => {
    await spawn()
    const pane = await $.ui.mount({
      plugin: 'terminal-polish',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'terminal-polish-monitor',
      props: { title: 'AI monitor', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })
    const lines = (await pane.findAll({ type: 'Text' })).map(t => t.text)
    await pane.unmount()
    return lines
  }
  const first = await shot()
  await clock.advance(60_000)
  const later = await shot()
  expect(later.join('\n')).toContain('2 agent đang chạy')
  expect(later.join('\n')).toContain('#2 Dương Quá')
  expect(later.join('\n')).toContain('#3 Tiểu Long Nữ')
  // A finished subagent leaves the pane; the header still counts it.
  expect(first.join('\n')).not.toContain('task a1')
  expect(later.join('\n')).toContain('3 agent trong session')
})

test('subagents take hero names by spawn order, with moves and type icons', () => {
  expect(heroName(1)).toBe('Lệnh Hồ Xung')
  expect(heroName(21)).toBe('Lệnh Hồ Xung 2')
  expect(ascii('Độc Cô Cầu Bại')).toBe('Doc Co Cau Bai')
  expect(['Độc Cô Cửu Kiếm', 'Hấp Tinh Đại Pháp', 'Phá Kiếm Thức']).toContain(heroMove(1, 'Read a.ts'))
  expect(heroMove(1, 'Read a.ts')).toBe(heroMove(1, 'Read a.ts'))
  expect(agentIcon('Explore')).toBe('🔍')
  expect(agentIcon('terminal-polish:tester')).toBe('🧪')
  expect(agentIcon('general-purpose')).toBe('⚔')
  expect(agentIcon('quick-suite')).toBe('⚔')
  expect(agentIcon('ui-ux-pro')).toBe('🎨')
})

test('a tool call reads as one line: command, file, pattern or task', () => {
  expect(toolLabel({ tool: 'Bash', command: 'npm test\n  --watch' })).toBe('npm test ⏎ --watch')
  expect(toolLabel({ tool: 'Edit', file_path: '/repo/hooks/register.tsx' })).toBe('register.tsx')
  expect(toolLabel({ tool: 'Grep', pattern: 'heroName' })).toBe('heroName')
  expect(toolLabel({ tool: 'Agent', description: 'Tìm chỗ vẽ pane', prompt: 'dài' })).toBe('Tìm chỗ vẽ pane')
  expect(toolLabel({ tool: 'TodoWrite', todos: [] })).toBe('')
})

test('each loop sees only its own calls: running now, then the last ended, newest first', () => {
  const c = (id: string, state: 'run' | 'ok' | 'fail', agent?: string) => ({ id, tool: 'Bash', label: id, state, ...(agent ? { agent } : {}) })
  const list = [c('m1', 'ok'), c('s1', 'run', 'a1'), c('m2', 'fail'), c('m3', 'run'), c('m4', 'ok')]
  const main = activityOf(list, undefined)
  expect(main.running.map(x => x.id)).toEqual(['m3'])
  expect(main.recent.map(x => x.id)).toEqual(['m4', 'm2', 'm1'])
  expect(activityOf(list, 'a1').running.map(x => x.id)).toEqual(['s1'])
  expect(activityOf(list, undefined, 1).recent.map(x => x.id)).toEqual(['m4'])
})

test('monitor charts: tool icon, meter, tool mix and call-time bars', () => {
  expect(toolIcon('Bash')).toBe('💻')
  expect(toolIcon('mcp__x__y')).toBe('🔌')
  expect(toolIcon('Unknown')).toBe('🛠')
  expect(meter(60, 5)).toBe('▰▰▰▱▱')
  expect(meter(150, 4)).toBe('▰▰▰▰')
  expect(meter(-5, 3)).toBe('▱▱▱')
  const c = (tool: string, state: 'run' | 'ok' | 'fail', ms?: number) => ({ id: tool + ms, tool, label: '', state, ...(ms !== undefined ? { ms } : {}) })
  const list = [c('Read', 'ok', 100), c('Bash', 'ok', 800), c('Read', 'fail', 400), c('Grep', 'run')]
  expect(toolMix(list)).toEqual([['Read', 2], ['Bash', 1], ['Grep', 1]])
  expect(durSpark(list)).toBe('▂█▅')
})

test('a main call left running when the turn ends settles as failed; subagent calls stay', () => {
  const c = (id: string, state: 'run' | 'ok', agent?: string) => ({ id, tool: 'Bash', label: '', state, ...(agent ? { agent } : {}) })
  const out = settleCalls([c('m1', 'run'), c('m2', 'ok'), c('s1', 'run', 'a1')])
  expect(out.map(x => x.state)).toEqual(['fail', 'ok', 'run'])
  const by = callsByAgent(out)
  expect(by.get('')?.map(x => x.id)).toEqual(['m1', 'm2'])
  expect(by.get('a1')?.map(x => x.id)).toEqual(['s1'])
})
