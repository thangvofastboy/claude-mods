import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { autoUpdate } from '../hooks/register'

const engine = (root: string, now: number, checked: number, ran: string[]) =>
  ({
    plugin: { root },
    clock: { now: async () => now, after: () => ({ cancel() {} }) },
    store: { get: async () => checked, set: async () => undefined },
    state: { get: async () => ({ value: undefined, version: 0 }), set: async () => ({ isSet: true, version: 1 }) },
    process: {
      run: async (argv: string[]) => (
        ran.push(argv.join(' ')),
        { exitCode: 0, stdout: argv[0] === 'git' ? '' : 'ok', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
      ),
    },
    command: { run: async () => ({}) },
    ui: { toast: () => undefined },
  }) as unknown as EngineInterface

const CACHE = '/home/x/.claude/plugins/cache/claude-mods/terminal-polish/0.6.0'

test('auto update skips a dev folder and a check made under 6 hours ago', async () => {
  const ran: string[] = []
  await autoUpdate(engine('/home/x/dev/claude-mods', 100, 0, ran))
  await autoUpdate(engine(CACHE, 1_000, 500, ran))
  expect(ran).toEqual([])
})

test('auto update checks a marketplace install once the interval has passed', async () => {
  const ran: string[] = []
  await autoUpdate(engine(CACHE, 7 * 3_600_000, 0, ran))
  expect(ran.length).toBeGreaterThan(0)
})
