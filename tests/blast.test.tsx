import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { answerBlast, blastOf, holdBlast } from '../hooks/register'

const R = 'r' + 'm'
const PUSH = 'git ' + 'push'

test('blast radius holds risky commands and lets ordinary ones run', () => {
  expect(blastOf(`${R} -rf build`)).toEqual({ kind: 'rm', targets: ['build'] })
  expect(blastOf(`cd app && ${R} -r -- dist "old logs"`)?.kind).toBe('rm')
  expect(blastOf('git reset --hard HEAD~1')).toEqual({ kind: 'reset' })
  expect(blastOf('git clean -fdx')).toEqual({ kind: 'clean', flags: ['-dx'] })
  expect(blastOf('git checkout -- .')).toEqual({ kind: 'discard' })
  expect(blastOf('git restore .')).toEqual({ kind: 'discard' })
  expect(blastOf(`${PUSH} --force-with-lease origin feature`)).toEqual({ kind: 'push', remote: 'origin', branch: 'feature' })
  expect(blastOf(`${PUSH} origin +fix`)).toEqual({ kind: 'push', remote: 'origin', branch: 'fix' })
  expect(blastOf(`sudo ${R} -rf build`)?.kind).toBe('rm')
  expect(blastOf('git checkout .')).toEqual({ kind: 'discard' })
  expect(blastOf('git clean -fd -e keep.txt')).toEqual({ kind: 'clean', flags: ['-d'] })
  for (const ok of [
    `${R} notes.txt`,
    `${R} -f one.log`,
    `docker ${R} -f web`,
    `git ${R} -r --cached dir`,
    `git commit -m "${R} -rf cleanup"`,
    `echo ${R} -rf build`,
    'git reset HEAD~1',
    'git clean -n',
    'git restore --staged .',
    `${PUSH} origin main`,
    'ls -rf',
  ]) {
    expect(blastOf(ok)).toBeUndefined()
  }
})

// The hold itself, with a stand-in engine: the measurement answers from memory,
// and the first wait in the loop presses the button.
for (const [answer, expected] of [
  ['cancel', 'cancel'],
  ['run', 'run'],
] as const) {
  test(`a held ${R} -rf measures what it deletes and waits for ${answer}`, async () => {
    const shown: unknown[] = []
    const $ = {
      state: {
        get: async () => ({ value: undefined, version: 0 }),
        set: async (_ref: unknown, value: unknown) => (shown.push(value), { isSet: true, version: 1 }),
      },
      clock: { now: async () => 0, after: () => ({ cancel() {} }) },
      ui: { toast: () => undefined },
      session: { cwd: async () => '/work/app' },
      process: {
        run: async (argv: string[]) => {
          const [cmd, , script] = argv
          if (cmd === 'sleep') void answerBlast($, 'call-1', answer)
          const stdout =
            cmd === 'du' ? '2048\tbuild\n2048\ttotal\n' : cmd === 'sh' && script?.startsWith('for p') ? 'build\n' : cmd === 'sh' ? '12\n' : ''
          return { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
        },
      },
    } as unknown as EngineInterface
    const verdict = await holdBlast($, 'call-1', `${R} -rf build`, { kind: 'rm', targets: ['build'] }, new AbortController().signal)
    expect(verdict).toBe(expected)
    expect(shown).toContainEqual(
      expect.objectContaining({ title: 'rm sẽ xóa 12 file (2.0 MB) trong 1 mục', lines: ['build'] }),
    )
    // The card is taken down once answered.
    expect(shown.at(-1)).toBeNull()
  })
}

test('Esc during a hold cancels it', async () => {
  const stop = new AbortController()
  const $ = {
    state: { get: async () => ({ value: undefined, version: 0 }), set: async () => ({ isSet: true, version: 1 }) },
    clock: { now: async () => 0, after: () => ({ cancel() {} }) },
    ui: { toast: () => undefined },
    session: { cwd: async () => '/work/app' },
    process: {
      run: async (argv: string[]) => {
        if (argv[0] === 'sleep') stop.abort()
        return { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
      },
    },
  } as unknown as EngineInterface
  expect(await holdBlast($, 'call-2', 'git reset --hard', { kind: 'reset' }, stop.signal)).toBe('cancel')
})

// Measuring must never act: a path named like a find expression stays a path,
// and a target the shell would rewrite is reported as unmeasured, not as "nothing".
test('measuring a held rm passes paths as paths and never guesses', async () => {
  const runs: string[][] = []
  const shown: { title?: string; note?: string }[] = []
  const fake = (found: string) =>
    ({
      state: {
        get: async () => ({ value: undefined, version: 0 }),
        set: async (_ref: unknown, value: unknown) => (shown.push((value ?? {}) as never), { isSet: true, version: 1 }),
      },
      clock: { now: async () => 0, after: () => ({ cancel() {} }) },
      ui: { toast: () => undefined },
      session: { cwd: async () => '/work/app' },
      process: {
        run: async (argv: string[]) => {
          runs.push(argv)
          if (argv[0] === 'sleep') void answerBlast(fake(found), 'm', 'cancel')
          const stdout = argv[0] === 'sh' && argv[2]?.startsWith('for p') ? found : argv[0] === 'du' ? '4\ttotal\n' : '1\n'
          return { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
        },
      },
    }) as unknown as EngineInterface

  await holdBlast(fake('-delete\n/abs/x\n'), 'm', `${R} -rf *`, { kind: 'rm', targets: ['*'] }, new AbortController().signal)
  const find = runs.find(a => a[0] === 'sh' && a[2]?.startsWith('find'))
  expect(find?.slice(4)).toEqual(['./-delete', '/abs/x'])
  expect(runs.find(a => a[0] === 'du')?.slice(2)).toEqual(['--', './-delete', '/abs/x'])

  runs.length = 0
  await holdBlast(fake(''), 'm', `${R} -rf "$BUILD_DIR"`, { kind: 'rm', targets: ['$BUILD_DIR'] }, new AbortController().signal)
  expect(runs.some(a => a[0] === 'du' || a[2]?.startsWith('for p'))).toBe(false)
  expect(shown).toContainEqual(expect.objectContaining({ title: 'Không đo được lệnh này sẽ thay đổi gì' }))
})
