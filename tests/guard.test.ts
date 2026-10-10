import { expect, test } from 'claude-code/testing'

const said = (r: { deny?: string; text?: string }) => r.deny ?? r.text ?? ''

// The guard is a security path: one check that it denies the dangerous
// spelling and lets the safe sibling through to what lies beneath. No clock
// is mocked on purpose: the bookkeeping hook then fails, and the guard must
// hold anyway.
test('guard denies a force-push to main and lets --force-with-lease through', async ($, on) => {
  on('tool.call', () => ({ deny: 'reached-bottom' }))
  on('ui.toast', () => ({ value: undefined }))

  const blocked = await $.tool.call({ tool: 'Bash', command: 'git push --force origin main' })
  expect(said(blocked)).toContain('terminal-polish')

  const allowed = await $.tool.call({ tool: 'Bash', command: 'git push --force-with-lease origin main' })
  expect(said(allowed)).toContain('reached-bottom')

  const secret = await $.tool.call({ tool: 'Write', file_path: '/tmp/x/.env', content: 'A=1' })
  expect(said(secret)).toContain('terminal-polish')

  const template = await $.tool.call({ tool: 'Write', file_path: '/tmp/x/.env.example', content: 'A=' })
  expect(said(template)).toContain('reached-bottom')
})
