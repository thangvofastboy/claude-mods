import { expect, mock, test } from 'claude-code/testing'

// An MCP tool's result is content: a string or blocks. An object here makes
// every call the model makes fail its output check (found live, v0.3).
test('notify_me answers with a string result', async ($, on) => {
  mock.store(on)
  on('ui.toast', () => ({ value: undefined }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'kitty' } }))
  const ran = await $.tool.call({ tool: 'mcp__terminal-polish__notify_me', message: 'xong rồi' })
  expect(typeof ran.result).toBe('string')
  expect(ran.result).toBe('Notified the user.')
})
