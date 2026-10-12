import { expect, mock, test } from 'claude-code/testing'
import { kTokens, weatherOf } from '../hooks/register'

const BAND = {
  plugin: 'terminal-polish',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`band on ${surface}: yields to a survey, shows, hides on press`, async ($, on) => {
    // Stands for the engine's own drawing, what the mod's next(e) reaches.
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })
    mock.store(on)

    const survey = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
    expect(await survey.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await survey.unmount()

    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /sẵn sàng/ })).toBeDefined()
    await ui.press({ key: 'hide' })
    expect(await ui.find({ type: 'Text', text: /sẵn sàng/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`dashboard pane and prompt card draw on ${surface}`, async ($, on) => {
    mock.clock(on)
    const pane = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'Pane',
      requestId: 'terminal-polish-dash',
      props: {
        title: 'Hoạt động',
        isFocused: false,
        bodyColumns: 60,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
    // Headings draw one run per character (gradient); the empty lists say so plainly.
    expect(await pane.find({ type: 'Text', text: 'chưa có' })).toBeDefined()
    await pane.unmount()

    const card = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'UserMessage',
      props: { text: 'xin chào', origin: { kind: 'composer' }, isExpanded: false },
    })
    expect(await card.find({ type: 'Text', text: /xin chào/ })).toBeDefined()
    await card.unmount()
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`sessions pane draws on ${surface}`, async $ => {
    const pane = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'Pane',
      requestId: 'terminal-polish-sessions',
      props: {
        title: 'Sessions',
        isFocused: false,
        bodyColumns: 40,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
    expect(await pane.find({ type: 'Text', text: /session ·/ })).toBeDefined()
    await pane.unmount()
  })
}

test('token weather: the forecast follows the fill, the delta reads short', async () => {
  expect([10, 30, 60, 80, 95].map(weatherOf)).toEqual(['☀', '☁', '☂', '☇', '↯'])
  expect([null, 0, -5, 850, 1234, 98_300, 1_250_000].map(kTokens)).toEqual([
    undefined,
    undefined,
    undefined,
    '+850',
    '+1.2k',
    '+98k',
    '+1.3M',
  ])
})
