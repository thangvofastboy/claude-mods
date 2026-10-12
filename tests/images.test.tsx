import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'
import { matchPics, openPic } from '../hooks/register'

// 1x1 PNG.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const image = (data: string, media_type = 'image/png') => ({
  type: 'image',
  source: { type: 'base64', media_type, data },
})

// The test kit answers no `session.messages`, so the matching is tested on its own.
test('a row finds the images of the stored message with its words', () => {
  const messages = [
    { role: 'user', content: [image('OLD'), { type: 'text', text: '[Image #1] xem giúp' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    { role: 'user', content: [{ type: 'text', text: 'khác' }] },
    {
      role: 'user',
      content: [image(PNG), image('JPG', 'image/jpeg'), { type: 'text', text: '[Image #2]  [Image #3]\nxem giúp' }],
    },
    { role: 'user', content: [image('OTHER'), { type: 'text', text: '[Image #4] cái khác' }] },
  ]
  const pics = matchPics(messages, '[Image #2] [Image #3] xem giúp')
  expect(pics).toEqual([
    { mediaType: 'image/png', data: PNG, label: '[Image #2]' },
    { mediaType: 'image/jpeg', data: 'JPG', label: '[Image #3]' },
  ])
  expect(matchPics(messages, 'không có ảnh')).toEqual([])
  expect(matchPics(messages, '[Image #9] chưa lưu')).toEqual([])
  // A prompt that is only the image takes the newest message with images.
  expect(matchPics(messages, '[Image #4]').map(p => p.data)).toEqual(['OTHER'])
})

test('opening a picture pipes its bytes to a temp file and the viewer', async () => {
  const runs: { argv: readonly string[]; stdin?: string }[] = []
  const $ = {
    process: {
      run: async (argv: readonly string[], init?: { stdin?: string }) => {
        runs.push({ argv, stdin: init?.stdin })
        return { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
      },
    },
  } as unknown as EngineInterface
  await openPic($, { label: '[Image #1]', mediaType: 'image/jpeg', data: 'JPG' })
  expect(runs).toHaveLength(1)
  expect(runs[0]?.stdin).toBe('JPG')
  expect(runs[0]?.argv.at(-1)).toBe('jpeg')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a prompt without images keeps its card on ${surface}`, async ($, on) => {
    mock.store(on)
    const ui = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'UserMessage',
      requestId: `msg-${surface}`,
      props: { text: 'xin chào', origin: { kind: 'composer' }, isExpanded: false },
    })
    expect(await ui.find({ type: 'Text', text: /xin chào/ })).toBeDefined()
    expect(await ui.find({ key: `open-msg-${surface}-0` })).toBeUndefined()
    await ui.unmount()
  })

  test(`an image row whose message is not found still draws on ${surface}`, async ($, on) => {
    mock.store(on)
    const ui = await $.ui.mount({
      plugin: 'terminal-polish',
      surface,
      component: 'UserMessage',
      requestId: `img-${surface}`,
      props: { text: '[Image #1] xem', origin: { kind: 'composer' }, isExpanded: false },
    })
    expect(await ui.find({ type: 'Text', text: /\[Image #1\] xem/ })).toBeDefined()
    await ui.unmount()
  })
}
