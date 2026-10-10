import { expect, test } from 'claude-code/testing'

test('/mods update from a dev folder explains how to install and never reloads', async ($, on) => {
  const reloads: string[] = []
  on('command.run', { command: 'reload-plugins' }, (_$, e) => {
    reloads.push(e.command)
    return { text: 'reloaded' }
  })

  const ran = await $.command.run({
    command: 'mods',
    args: 'update',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(ran.text).toContain('/plugin install terminal-polish@claude-mods')
  expect(reloads).toEqual([])
})
