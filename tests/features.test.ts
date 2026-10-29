import { expect, test } from 'claude-code/testing'
import {
  agentPlan,
  failName,
  formatReset,
  inQuiet,
  outputOf,
  pinText,
  prDraft,
  quotaAlert,
  relatedCommand,
  searchPrompts,
  spendSince,
  transcriptPrompts,
} from '../hooks/register'

const NOW = Date.parse('2026-10-29T12:00:00Z')

test('quiet hours run from 22h to 8h only', () => {
  expect([21, 22, 3, 7, 8, 12].map(inQuiet)).toEqual([false, true, true, true, false, false])
})

test('a reset time reads as hours and minutes, or as soon when past', () => {
  expect(formatReset('2026-10-29T14:15:00Z', NOW)).toBe('2h15m')
  expect(formatReset('2026-10-29T12:40:00Z', NOW)).toBe('40m')
  expect(formatReset('2026-10-29T11:00:00Z', NOW)).toBe('sắp reset')
  expect(formatReset(undefined, NOW)).toBe('chưa rõ')
})

test('quota alerts once per window at 90% and above', () => {
  const limits = [{ kind: 'five_hour', percent: 93, resetsAt: '2026-10-29T14:00:00Z' }]
  const first = quotaAlert(limits, '', NOW)
  expect(first?.text).toBe('5h đã dùng 93% · reset sau 2h0m')
  expect(quotaAlert(limits, first?.keys ?? '', NOW)).toBeNull()
  expect(quotaAlert([{ kind: 'seven_day', percent: 50 }], '', NOW)).toBeNull()
  // A new window (a later reset) alerts again.
  const next = [{ kind: 'five_hour', percent: 91, resetsAt: '2026-10-29T19:00:00Z' }]
  expect(quotaAlert(next, first?.keys ?? '', NOW)?.text).toContain('5h đã dùng 91%')
})

test('two limits over the line do not alternate alerts', () => {
  const both = [
    { kind: 'five_hour', percent: 95, resetsAt: 'a' },
    { kind: 'seven_day', percent: 92, resetsAt: 'b' },
  ]
  const first = quotaAlert(both, '', NOW)
  expect(quotaAlert(both, first?.keys ?? '', NOW)).toBeNull()
})

test('the failing test name comes from the runner output', () => {
  expect(failName(' FAIL  tests/a.test.ts > adds two numbers')).toBe('adds two numbers')
  expect(failName('  ● suite › fails softly')).toBe('suite › fails softly')
  expect(failName('FAILED tests/test_x.py::test_y - assert 1 == 2')).toBe('tests/test_x.py::test_y')
  expect(failName('--- FAIL: TestParse (0.00s)')).toBe('TestParse')
  expect(failName('all good')).toBeNull()
})

test('related tests follow the runner named in package.json', () => {
  expect(relatedCommand('{"devDependencies":{"vitest":"^2"}}', ['/p/a.ts'])).toEqual([
    'npx',
    '--no-install',
    'vitest',
    'related',
    '--run',
    '/p/a.ts',
  ])
  expect(relatedCommand('{"devDependencies":{"jest":"^29"}}', ['/p/a.ts', '/p/b.ts'])).toEqual([
    'npx',
    '--no-install',
    'jest',
    '--findRelatedTests',
    '/p/a.ts',
    '/p/b.ts',
  ])
  expect(relatedCommand('{}', ['/p/a.ts'])).toBeNull()
  expect(relatedCommand('{"jest":1}', [])).toBeNull()
})

test('prompt search is case-blind, newest first, without repeats', () => {
  const texts = ['sửa Login', 'thêm cache', 'sửa login', 'sửa login']
  expect(searchPrompts(texts, 'LOGIN')).toEqual(['sửa login', 'sửa Login'])
  expect(searchPrompts(texts, 'zzz')).toEqual([])
})

test('transcript lines yield only the user text, and a partial line is skipped', () => {
  const lines = [
    JSON.stringify({ type: 'user', message: { content: 'hỏi về API' } }),
    JSON.stringify({ type: 'assistant', message: { content: 'trả lời' } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'kèm khối' }] } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result' }] } }),
    '{"type":"user","mess',
  ]
  expect(transcriptPrompts(lines)).toEqual(['hỏi về API', 'kèm khối'])
})

test('a week of spend sums every project on the listed days only', () => {
  const stats = {
    '2026-10-29': { a: { usd: 1.5 }, b: { usd: 0.5 } },
    '2026-10-22': { a: { usd: 9 } },
    '2026-10-28': { a: { usd: 2 } },
  }
  expect(spendSince(stats, ['2026-10-29', '2026-10-28'])).toBe(4)
})

test('a PR draft lists the commits, or says there are none, then the diffstat', () => {
  const draft = prDraft('feat: a\nfix: b\n', ' a.ts | 2 +-\n')
  expect(draft).toContain('- feat: a\n- fix: b')
  expect(draft).toContain('a.ts | 2 +-')
  expect(prDraft('', '')).toContain('- Chưa có commit mới so với nhánh gốc.')
})

test('a pinned answer is trimmed to 500 characters', () => {
  expect(pinText('  ngắn  ')).toBe('ngắn')
  expect(pinText('x'.repeat(600)).length).toBe(501)
})

test('a Bash result reads as text from a string or from stdout and stderr', () => {
  expect(outputOf('plain')).toBe('plain')
  expect(outputOf({ stdout: 'out', stderr: 'err' })).toBe('out\nerr')
  expect(outputOf(undefined)).toBe('')
})

test('auto model routes subagents by type first, then by description', () => {
  const plan = agentPlan
  expect(plan('Explore', 'review the auth flow')).toEqual({ model: 'haiku', effort: 'low' })
  expect(plan('ecc:code-reviewer', 'check the diff')).toEqual({ model: 'opus', effort: 'high' })
  expect(plan('Plan', 'find files')).toEqual({ model: 'opus', effort: 'high' })
  expect(plan('general-purpose', 'Find all callers of foo')).toEqual({ model: 'haiku', effort: 'low' })
  expect(plan('general-purpose', 'Debug the flaky test')).toEqual({ model: 'opus', effort: 'high' })
  expect(plan('general-purpose', 'tìm file cấu hình')).toEqual({ model: 'haiku', effort: 'low' })
  expect(plan('general-purpose', 'thiết kế API mới')).toEqual({ model: 'opus', effort: 'high' })
  expect(plan('general-purpose', 'Implement the login form')).toEqual({ model: 'sonnet', effort: 'medium' })
})
