import { expect, test } from 'claude-code/testing'

const said = (r: { deny?: string; text?: string }) => r.deny ?? r.text ?? ''
// Spelled apart, so no shell line that touches this file carries the patterns
// the guard stops (it would stop that line too).
const R = 'r' + 'm'
const PUSH = 'git ' + 'push'

// The guard is a security path: one check that it denies the dangerous
// spellings and lets the safe siblings through to what lies beneath. No clock
// is mocked on purpose: the bookkeeping hook then fails, and the guard must
// hold anyway.
test('guard denies dangerous spellings and lets safe siblings through', async ($, on) => {
  on('tool.call', () => ({ deny: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))

  for (const command of [
    `${PUSH} --force origin main`,
    `${PUSH} -fu origin main`,
    `${PUSH} origin +main`,
    `${R} -rf ~/*`,
    `${R} -rf "$HOME"`,
    `${R} -r -f ~`,
  ]) {
    expect(said(await $.tool.call({ tool: 'Bash', command }))).toContain('terminal-polish')
  }
  for (const command of [`${PUSH} --force-with-lease origin main`, `${R} -rf ./build`, `${R} -rf ~/projects/x`]) {
    expect(said(await $.tool.call({ tool: 'Bash', command }))).toContain('reached-bottom')
  }

  const secret = await $.tool.call({ tool: 'Write', file_path: '/tmp/x/.env', content: 'A=1' })
  expect(said(secret)).toContain('terminal-polish')
  const template = await $.tool.call({ tool: 'Write', file_path: '/tmp/x/.env.example', content: 'A=' })
  expect(said(template)).toContain('reached-bottom')
})

test('Monitor runs a shell command, so the guard covers it too', async ($, on) => {
  on('tool.call', () => ({ deny: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))
  const ran = await $.tool.call({ tool: 'Monitor', command: `${R} -rf ~/*`, description: 'x' } as never)
  expect(said(ran)).toContain('terminal-polish')
})
