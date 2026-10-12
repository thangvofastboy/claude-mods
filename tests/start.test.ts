import { expect, mock, test } from 'claude-code/testing'

// session.start loads everything side by side; the band then shows the project and the greeting.
test('session start loads the project, home and greeting without spawning printenv', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, { HOME: '/home/someone' })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/tmp/proj' }))
  on('session.id', () => ({ value: 'abc' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const argv: string[] = []
  on('process.run', (_$, e) => {
    argv.push(e.argv[0] ?? '')
    return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  expect(await $.session.start({ cwd: '/tmp/proj', surface: 'terminal', isInteractive: true })).toEqual({
    cwd: '/tmp/proj',
  })
  const band = await $.ui.mount({
    plugin: 'terminal-polish',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 19 }, view: {} },
  })
  const text = (await band.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(text).toContain('◆ proj')
  expect(text).toContain('someone 👋')
  expect(argv).not.toContain('printenv')
  await band.unmount()
})

// /clear resets $.state and fires no session.start: the classic SessionStart hook loads the store again.
test('after /clear the saved theme and settings come back', async ($, on) => {
  mock.clock(on)
  mock.store(on, { theme: 'dracula', settings: { compact: true } })
  mock.env(on, { HOME: '/home/someone' })
  on('classic.SessionStart', () => ({}))
  on('session.root', () => ({ value: '/tmp/proj' }))
  on('process.run', () => ({
    value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  const mods = (args: string) =>
    $.command.run({ command: 'mods', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  // State still holds the defaults, as right after a /clear.
  expect((await mods('theme')).text).toContain('đang dùng: auto')

  await $.classic.SessionStart({ source: 'clear' })
  expect((await mods('theme')).text).toContain('đang dùng: dracula')
  expect((await mods('help')).text).toMatch(/compact\s+\[bật\]/)
})
