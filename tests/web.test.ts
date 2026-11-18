import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { applyWebChange, webCommand } from '../hooks/register'

// A stand-in engine: state and store in memory, so the page's changes can be read back.
function fake() {
  const state = new Map<string, { value: unknown; version: number }>()
  const store = new Map<string, unknown>()
  const id = (ref: { plugin: string; key: string }) => `${ref.plugin}/${ref.key}`
  const $ = {
    state: {
      get: async (ref: { plugin: string; key: string }) => state.get(id(ref)) ?? { value: undefined, version: 0 },
      set: async (ref: { plugin: string; key: string }, value: unknown) => {
        const version = (state.get(id(ref))?.version ?? 0) + 1
        state.set(id(ref), { value, version })
        return { isSet: true, version }
      },
    },
    store: { get: async (k: string) => store.get(k), set: async (k: string, v: unknown) => void store.set(k, v) },
    fs: { write: async () => undefined },
  } as unknown as EngineInterface
  return { $, settings: () => store.get('settings') as Record<string, boolean> | undefined, store }
}

test('the settings page sets a known toggle, a theme and the presets', async () => {
  const { $, settings, store } = fake()
  await applyWebChange($, { key: 'crew', value: true })
  expect(settings()?.crew).toBe(true)
  await applyWebChange($, { defaults: true })
  expect(settings()?.crew).toBe(false)
  await applyWebChange($, { all: true })
  expect(settings()?.crew).toBe(true)
  expect(settings()?.automodel).toBe(false)
  await applyWebChange($, { theme: 'auto' })
  expect(store.get('theme')).toBe('auto')
})

test('the settings page cannot set unknown keys, non-booleans or prototype names', async () => {
  const { $, settings, store } = fake()
  for (const change of [
    { key: 'constructor', value: true },
    { key: '__proto__', value: true },
    { key: 'nope', value: true },
    { key: 'crew', value: 'yes' },
    { theme: 'toString' },
    null,
    'crew',
  ]) {
    await applyWebChange($, change)
  }
  expect(settings()).toBeUndefined()
  expect(store.get('theme')).toBeUndefined()
})

// /mods web with a stand-in child: the test decides when it prints and when it ends.
function fakeWeb() {
  const base = fake()
  const spawns: string[][] = []
  const opened: string[] = []
  let push: (line: string) => void = () => undefined
  let end: () => void = () => undefined
  const process = {
    hookEnv: async () => ({ CLAUDE_PLUGIN_DATA: '/data' }),
    run: async (argv: string[]) => (opened.push(argv[4] ?? ''), { exitCode: 0, stdout: '', stderr: '' }),
    spawn: ({ argv }: { argv: string[] }) => {
      spawns.push(argv)
      const queue: string[] = []
      let wake: (() => void) | null = null
      let done = false
      push = line => (queue.push(line), wake?.())
      end = () => ((done = true), wake?.())
      return (async function* () {
        while (true) {
          while (queue.length) yield { stream: 'stdout', text: queue.shift() }
          if (done) return { code: 0, signal: null }
          await new Promise<void>(r => (wake = r))
          wake = null
        }
      })()
    },
  }
  const $ = Object.assign(Object.create(base.$ as object), {
    process,
    plugin: { root: '/plugin' },
    clock: { after: () => ({ cancel: () => undefined }) },
  }) as typeof base.$
  return { ...base, $, spawns, opened, push: (l: string) => push(l), end: () => end() }
}

const tick = () => new Promise(r => setTimeout(r, 0))

test('/mods web starts one page, applies its changes and starts again once it exits', async () => {
  const w = fakeWeb()
  const first = webCommand(w.$)
  const second = webCommand(w.$)
  await tick()
  w.push('PORT 4242\n')
  const [a, b] = await Promise.all([first, second])
  expect(w.spawns).toHaveLength(1)
  expect(w.spawns[0]?.slice(0, 2)).toEqual(['node', '/plugin/scripts/settings-web.mjs'])
  expect(a).toContain('http://127.0.0.1:4242/?t=')
  expect(b).toBe(a)
  expect(w.opened).toHaveLength(2)

  // A change split across pieces, and a bad line that must not end the page.
  w.push('SET {"key":"cr')
  w.push('ew","value":true}\nSET {oops\n')
  await tick()
  await tick()
  expect(w.settings()?.crew).toBe(true)

  w.end()
  await tick()
  const again = webCommand(w.$)
  await tick()
  w.push('PORT 4343\n')
  expect(await again).toContain('http://127.0.0.1:4343/')
  expect(w.spawns).toHaveLength(2)
})
