import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { copyFile } from '../hooks/register'

// Checkpoints copy with cp, byte for byte: a string round trip would mangle a binary file.
test('copyFile makes the folder, copies with cp, and reports a failure', async () => {
  const runs: string[][] = []
  let failCp = false
  const $ = {
    process: {
      run: async (argv: string[]) => {
        runs.push(argv)
        const failed = failCp && argv[0] === 'cp'
        return { exitCode: failed ? 1 : 0, stdout: '', stderr: failed ? 'cp: denied' : '' }
      },
    },
  } as unknown as EngineInterface

  expect(await copyFile($, '/src/logo.png', '/home/u/.claude/cp/1-logo.png')).toBe('')
  expect(runs).toEqual([
    ['mkdir', '-p', '--', '/home/u/.claude/cp'],
    ['cp', '--', '/src/logo.png', '/home/u/.claude/cp/1-logo.png'],
  ])

  failCp = true
  expect(await copyFile($, '/a', '/b/c')).toBe('cp: denied')
})
