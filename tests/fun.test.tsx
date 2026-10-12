import { expect, mock, test } from 'claude-code/testing'
import { forecastFor, JOKES } from '../hooks/register'

const DAY = new Date(2026, 9, 12, 9).getTime()

test("today's forecast holds all day and changes with the day", () => {
  expect(forecastFor(DAY)).toMatch(/^Dự báo hôm nay: .+\. .+/)
  expect(forecastFor(DAY + 10 * 3600_000)).toBe(forecastFor(DAY))
  const week = Array.from({ length: 7 }, (_, i) => forecastFor(DAY + i * 86_400_000))
  expect(new Set(week).size).toBeGreaterThan(1)
})

const SPINNER = {
  plugin: 'terminal-polish',
  surface: 'terminal',
  component: 'Spinner',
  props: { word: 'Thinking', message: null, suffix: '', mode: 'thinking' },
} as const

test('a joke rides beside the spinner, and fun turns it off', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: DAY })
  // Stands for the engine's spinner: it draws the word and the suffix it was handed.
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{`${e.props.word}${e.props.suffix}`}</Text>
  })
  const line = async () => {
    const ui = await $.ui.mount(SPINNER)
    const text = (await ui.find({ type: 'Text' }))?.text ?? ''
    await ui.unmount()
    return text
  }
  const joke = (await line()).replace(/^Đang nghĩ · /, '')
  expect(JOKES).toContain(joke)

  const mods = (args: string) =>
    $.command.run({ command: 'mods', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect((await mods('vui')).text).toMatch(/🔮 Dự báo hôm nay/)
  expect((await mods('fun')).text).toContain('TẮT')
  expect(await line()).toBe('Đang nghĩ')
})
