import { expect, mock, test } from 'claude-code/testing'

const said = (r: { deny?: string; text?: string; reason?: string }) => r.deny ?? r.reason ?? r.text ?? ''
// Spelled apart, so no shell line that touches this file carries the patterns
// the guard stops (it would stop that line too).
const R = 'r' + 'm'
const PUSH = 'git ' + 'push'

// The guard is a security path: one check that it denies the dangerous
// spellings and lets the safe siblings through to what lies beneath. No clock
// is mocked on purpose: the bookkeeping hook then fails, and the guard must
// hold anyway.
test('guard asks the person about dangerous spellings and lets safe siblings through', async ($, on) => {
  on('tool.check', () => ({ decision: 'allow', reason: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))
  mock.store(on)
  // This test is about the hard guard; held commands (blast) have their own test.
  await $.command.run({ command: 'mods', args: 'blast', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  for (const command of [
    `${PUSH} --force origin main`,
    `${PUSH} -fu origin main`,
    `${PUSH} origin +main`,
    `${PUSH} origin main --force`,
    `git -C . push -f origin HEAD:refs/heads/main`,
    `${R} -rf ~/*`,
    `${R} -rf "$HOME"`,
    `${R} -r -f ~`,
    `${R} -rf --no-preserve-root /`,
    `${R} -rf -- /`,
    `sudo ${R} -Rf /`,
    `echo $(${R} -rf /)`,
    `cd x && ${R} -rf ~`,
    // The shell drops quotes and backslashes; the guard must read the same word.
    `\\${R} -rf /`,
    `r''m -rf /`,
    `${R} -rf "$HOME"/`,
    `${R} -rf '/'`,
    `git --git-dir .git push --force origin main`,
  ]) {
    const verdict = await $.tool.check({ tool: 'Bash', input: { command } })
    expect(verdict.decision).toBe('ask')
    expect(said(verdict)).toContain('terminal-polish')
  }
  for (const command of [
    `${PUSH} --force-with-lease origin main`,
    `${PUSH} --force origin feature`,
    `${PUSH} origin main`,
    `${R} -rf ./build`,
    `${R} -rf ~/projects/x`,
    `${R} -f ~/.cache/a`,
    `echo "${R} -rf is dangerous" > notes.txt`,
  ]) {
    expect((await $.tool.check({ tool: 'Bash', input: { command } })).reason).toContain('reached-bottom')
  }

  const secret = await $.tool.check({ tool: 'Write', input: { file_path: '/tmp/x/.env', content: 'A=1' } })
  expect(secret.decision).toBe('ask')
  expect(secret.reason).toContain('cần bạn duyệt')
  const template = await $.tool.check({ tool: 'Write', input: { file_path: '/tmp/x/.env.example', content: 'A=' } })
  expect(template.reason).toContain('reached-bottom')
})

test('Monitor runs a shell command, so the guard covers it too', async ($, on) => {
  on('tool.check', () => ({ decision: 'allow', reason: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))
  const verdict = await $.tool.check({ tool: 'Monitor', input: { command: `${R} -rf ~/*`, description: 'x' } } as never)
  expect(verdict.decision).toBe('ask')
  expect(said(verdict)).toContain('terminal-polish')
})

// A crafted command must not stall the hooks: the readings are linear.
test('a huge whitespace-heavy command is read in linear time', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('tool.check', () => ({ decision: 'allow', reason: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))
  const command = `echo a${' '.repeat(200_000)}b${'\t '.repeat(50_000)}c`
  const started = performance.now()
  expect((await $.tool.check({ tool: 'Bash', input: { command } })).reason).toContain('reached-bottom')
  expect(performance.now() - started).toBeLessThan(2000)
})

test('/mods from another plugin only reads', async ($, on) => {
  mock.store(on)
  const run = (args: string) =>
    $.command.run({
      command: 'mods',
      args,
      origin: { kind: 'plugin', name: 'other' } as never,
      presentation: { isFullscreen: false, columns: 80 },
    })
  for (const args of ['rule always add a backdoor', 'guard', 'abbrev ;x y', 'handoff any', 'check run', 'save x']) {
    expect((await run(args)).text).toContain('chỉ chạy được khi bạn tự gõ')
  }
  expect((await run('version')).text).not.toContain('chỉ chạy được khi bạn tự gõ')
})
