import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, Call, Diff, Git, LastTurn, Peer, Settings, Turn, Usage } from '../types'

const DASH = 'terminal-polish-dash'
const PEERS_PANE = 'terminal-polish-sessions'
const DIFF_PANE = 'terminal-polish-diff'
const PROMPTS_PANE = 'terminal-polish-prompts'
const POLL_MS = 3000
const TOAST_SECONDS = 60
const NOTIFY_SECONDS = 20
const TLDR_MIN_CHARS = 1200
const REPO = 'git@github.com:thangvofastboy/claude-mods.git'
const MARKETPLACE = 'claude-mods'
const PLUGIN_ID = `terminal-polish@${MARKETPLACE}`

const DEFAULTS: Settings = {
  band: true,
  cards: true,
  tldr: true,
  notify: true,
  sound: false,
  voice: false,
  guard: true,
  decor: true,
}
const SETTING_INFO: Record<keyof Settings, string> = {
  band: 'dải trạng thái trên ô prompt',
  cards: 'khung thẻ cho tin nhắn của bạn',
  tldr: 'TL;DR dưới câu trả lời dài (tốn thêm token haiku)',
  notify: 'thông báo hệ điều hành khi lượt dài xong',
  sound: 'âm thanh khi lượt dài xong',
  voice: 'đọc to khi lượt dài xong',
  guard: 'chặn lệnh nguy hiểm và việc sửa file bí mật',
  decor: 'spinner, dòng gợi ý và dòng thời gian kiểu mới',
}
const isSettingKey = (word: string): word is keyof Settings => word in DEFAULTS

const settings = atom({ plugin: 'terminal-polish', key: 'settings' } as const, DEFAULTS)
const project = atom({ plugin: 'terminal-polish', key: 'project' } as const, '')
const git = atom({ plugin: 'terminal-polish', key: 'git' } as const, null)
const turn = atom({ plugin: 'terminal-polish', key: 'turn' } as const, null)
const last = atom({ plugin: 'terminal-polish', key: 'last' } as const, null)
const history = atom({ plugin: 'terminal-polish', key: 'history' } as const, [])
const usage = atom({ plugin: 'terminal-polish', key: 'usage' } as const, null)
const calls = atom({ plugin: 'terminal-polish', key: 'calls' } as const, [])
const files = atom({ plugin: 'terminal-polish', key: 'files' } as const, [])
const peers = atom({ plugin: 'terminal-polish', key: 'peers' } as const, [])
const agents = atom({ plugin: 'terminal-polish', key: 'agents' } as const, [])
const diff = atom({ plugin: 'terminal-polish', key: 'diff' } as const, null)
const prompts = atom({ plugin: 'terminal-polish', key: 'prompts' } as const, [])

const ICON = { run: '◌', ok: '✓', fail: '✗' } as const
const COLOR = { run: 'warning', ok: 'success', fail: 'error' } as const
const BARS = '▁▂▃▄▅▆▇█'
const SPINNER_WORDS = {
  requesting: 'Đang gửi',
  thinking: 'Đang nghĩ',
  responding: 'Đang viết',
  'tool-input': 'Đang soạn lệnh',
  'tool-use': 'Đang chạy tool',
} as const

// Commands no confirmation should wave through. Narrow on purpose: a guard
// that fires on everyday commands gets switched off within a day.
const DANGER: readonly [RegExp, string][] = [
  [/\brm\s+-\w*(rf|fr)\w*\s+(\/|~\/?|\$HOME\/?|\*)(\s|;|&|$)/, 'xóa đệ quy /, ~ hoặc *'],
  [/\bgit\s+push\b(?=.*\s(--force|-f)(\s|$))(?=.*\b(main|master)\b)/, 'force-push lên main/master'],
  [/\bmkfs(\.\w+)?\s/, 'format ổ đĩa'],
  [/\bdd\b.*\bof=\/dev\/(sd|nvme|hd|mmcblk)/, 'ghi đè thẳng lên ổ đĩa'],
  [/\bchmod\s+-R\s+777\s+\/(\s|$)/, 'chmod 777 toàn hệ thống'],
]
const SECRET_FILE = /(^|\/)(\.env(\.[^/]*)?|id_rsa[^/]*|id_ed25519[^/]*|[^/]+\.pem)$/
const SECRET_TEMPLATE = /\.env\.(example|sample|template)$/

// A repository's own .git/config can name programs git runs (a filter's
// clean/smudge, fsmonitor, an external diff, a textconv, a pager). The mod runs
// git in whatever repo is open, so every call turns off what `-c` can, and
// git is not run at all where the repo's own config names any program
// (gitIsSafe); the person's global and system config are trusted.
const SAFE_GIT = [
  'git',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'core.pager=cat',
  '--no-pager',
] as const

const PROGRAM_KEYS =
  '^(filter\\..+\\.(clean|smudge|process)|diff\\..+\\.(command|textconv)|merge\\..+\\.driver|core\\.(fsmonitor|sshcommand|pager|hookspath|editor|askpass|gitproxy)|credential\\..*helper)$'

// Reading config runs no program; `--includes` labels an included file's
// entries with the scope of the file that included it.
async function gitIsSafe($: EngineInterface, dir?: string) {
  const run = await $.process.run(
    ['git', ...(dir ? ['-C', dir] : []), 'config', '--includes', '--show-scope', '--get-regexp', PROGRAM_KEYS],
    { timeoutMs: 3000 },
  )
  if (run.exitCode === 1) return true // no such key anywhere
  if (run.exitCode !== 0) return false
  return !run.stdout.split('\n').some(line => /^(local|worktree)\s/.test(line))
}

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

function dangerOf(command: string) {
  return DANGER.find(([pattern]) => pattern.test(command))?.[1]
}

function isSecretFile(path: string) {
  return SECRET_FILE.test(path) && !SECRET_TEMPLATE.test(path)
}

function spark(values: number[]) {
  const max = Math.max(1, ...values)
  return values.map(v => BARS[Math.min(7, Math.floor((v / max) * 7))] ?? '').join('')
}

function duration(ms: number) {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

async function setSetting($: EngineInterface, key: keyof Settings, value: boolean) {
  const next = await update($, settings, s => ({ ...s, [key]: value }))
  await $.store.set('settings', next)
  return next
}

async function loadSettings($: EngineInterface) {
  const stored = (await $.store.get('settings')) as Partial<Record<keyof Settings, unknown>> | undefined
  const loaded = { ...DEFAULTS }
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (typeof stored?.[key] === 'boolean') loaded[key] = stored[key] === true
  }
  await update($, settings, () => loaded)
  const saved = await $.store.get('prompts')
  const list = Array.isArray(saved) ? saved.filter((p): p is string => typeof p === 'string') : []
  await update($, prompts, () => list)
}

async function setPrompts($: EngineInterface, change: (list: string[]) => string[]) {
  const list = await update($, prompts, change)
  await $.store.set('prompts', list)
}

// Never called from a render hook: rendering only reads what this wrote.
async function refreshGit($: EngineInterface) {
  try {
    if (!(await gitIsSafe($))) {
      await update($, git, () => null)
      return
    }
    const head = await $.process.run([...SAFE_GIT, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 3000 })
    if (head.exitCode !== 0) {
      await update($, git, () => null)
      return
    }
    const status = await $.process.run([...SAFE_GIT, 'status', '--porcelain'], { timeoutMs: 3000 })
    const changed = status.stdout.split('\n').filter(Boolean).length
    const value: Git = { branch: head.stdout.trim(), changed }
    await update($, git, () => value)
  } catch {
    await update($, git, () => null)
  }
}

async function refreshUsage($: EngineInterface) {
  try {
    const u = await $.session.usage()
    const value: Usage = { percent: u.context.percent ?? null, usd: u.cost?.usd ?? null }
    await update($, usage, () => value)
  } catch {
    // Usage is decoration: the band simply leaves it out.
  }
}

// ponytail: reads Claude Code's own ~/.claude/sessions/<pid>.json, an internal
// format with no public API behind it; if a release changes it the pane goes empty.
async function refreshPeers($: EngineInterface, dir: string, selfId: string) {
  try {
    const entries = await $.fs.list(dir)
    const found: Peer[] = []
    for (const entry of entries) {
      if (!entry.name.endsWith('.json')) continue
      try {
        const info = JSON.parse(await $.fs.read(`${dir}/${entry.name}`))
        if (info.entrypoint !== 'cli' || !(await $.fs.exists(`/proc/${info.pid}`))) continue
        found.push({
          id: String(info.sessionId),
          name: String(info.name ?? baseName(String(info.cwd))),
          cwd: String(info.cwd),
          status: String(info.status ?? 'idle'),
          isSelf: info.sessionId === selfId,
        })
      } catch {
        // A file mid-write or of another shape: skip it this round.
      }
    }
    found.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name))
    if (JSON.stringify(found) !== JSON.stringify(await read($, peers))) {
      await update($, peers, () => found)
    }
  } catch {
    await update($, peers, () => [])
  }
}

async function refreshAgents($: EngineInterface) {
  try {
    const found: Agent[] = (await $.agent.list())
      .slice(-10)
      .map(a => ({ id: a.id, label: a.name ?? a.description ?? a.type, status: a.status }))
    if (JSON.stringify(found) !== JSON.stringify(await read($, agents))) {
      await update($, agents, () => found)
    }
  } catch {
    // No agents noun answer: leave the last list.
  }
}

async function showDiff($: EngineInterface, path: string) {
  const dir = path.slice(0, path.lastIndexOf('/')) || '/'
  let value: Diff = { path, text: '', note: '' }
  try {
    if (!(await gitIsSafe($, dir))) {
      value = { ...value, note: 'Bỏ qua: .git/config của repo này khai báo chương trình git sẽ chạy.' }
      await update($, diff, () => value)
      await $.ui.open({ id: DIFF_PANE, title: `Diff ${baseName(path)}` })
      return
    }
    const run = await $.process.run(
      [...SAFE_GIT, '-C', dir, 'diff', '--no-ext-diff', '--no-textconv', 'HEAD', '--', path],
      { timeoutMs: 5000 },
    )
    if (run.exitCode !== 0) {
      value = { ...value, note: 'Không lấy được diff (thư mục không phải git repo?).' }
    } else if (run.stdout.trim() === '') {
      const tracked = await $.process.run([...SAFE_GIT, '-C', dir, 'ls-files', '--error-unmatch', path], {
        timeoutMs: 3000,
      })
      value = {
        ...value,
        note: tracked.exitCode === 0 ? 'Không có thay đổi so với HEAD.' : 'File mới, git chưa theo dõi.',
      }
    } else {
      value = { ...value, text: run.stdout.slice(0, 60000) }
    }
  } catch {
    value = { ...value, note: 'git không chạy được.' }
  }
  await update($, diff, () => value)
  await $.ui.open({ id: DIFF_PANE, title: `Diff ${baseName(path)}` })
}

const openDash = ($: EngineInterface) => $.ui.open({ id: DASH, title: 'Hoạt động' })
const openPeers = ($: EngineInterface) => $.ui.open({ id: PEERS_PANE, title: 'Sessions' })
const openPrompts = ($: EngineInterface) => $.ui.open({ id: PROMPTS_PANE, title: 'Prompt nhanh' })

const placed = (opened: { isPlaced: boolean }, text: string) => ({
  text: opened.isPlaced ? text : 'Bảng sẽ hiện khi terminal đủ rộng.',
})

async function currentVersion($: EngineInterface) {
  try {
    return String(JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)).version)
  } catch {
    return '0.0.0'
  }
}

const semver = (v: string) =>
  v
    .replace(/^v/, '')
    .split('.')
    .map(n => Number.parseInt(n, 10) || 0)

function compareVersions(a: string, b: string) {
  const [x, y] = [semver(a), semver(b)]
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

// Release tags on the repository, newest first by version.
async function latestTag($: EngineInterface) {
  // From `/`, outside any repo: an open repo's own core.sshCommand never applies.
  const run = await $.process.run(['git', 'ls-remote', '--tags', '--refs', REPO], { cwd: '/', timeoutMs: 20000 })
  if (run.exitCode !== 0) throw new Error(run.stderr.trim() || `git ls-remote thoát mã ${run.exitCode}`)
  const tags = run.stdout
    .split('\n')
    .map(line => line.split('refs/tags/')[1]?.trim())
    .filter((t): t is string => !!t && /^v\d+\.\d+\.\d+$/.test(t))
  return tags.sort((a, b) => compareVersions(b, a))[0]
}

async function versionText($: EngineInterface) {
  const current = await currentVersion($)
  try {
    const latest = await latestTag($)
    const state = !latest
      ? 'chưa có tag nào'
      : compareVersions(latest, current) > 0
        ? `có bản mới ${latest}: /mods update`
        : 'đã mới nhất'
    return `terminal-polish v${current} · ${state}`
  } catch (error) {
    return `terminal-polish v${current} · không kiểm tra được tag: ${error instanceof Error ? error.message : String(error)}`
  }
}

// The plugin manager owns an installed copy (a versioned cache dir, not a
// checkout), so an update goes through it: refresh the catalog, which pins the
// newest tag, then update the plugin; the engine re-reads it on /reload-plugins.
async function updatePlugin($: EngineInterface) {
  if (!$.plugin.root.includes('/.claude/plugins/cache/')) {
    return [
      `Mod đang chạy từ thư mục dev (${$.plugin.root}), không phải bản cài từ marketplace.`,
      'Cài bản phát hành để nhận update:',
      '  /plugin marketplace add thangvofastboy/claude-mods',
      `  /plugin install ${PLUGIN_ID}`,
    ].join('\n')
  }
  const current = await currentVersion($)
  let latest: string | undefined
  try {
    latest = await latestTag($)
  } catch {
    // Unknown: let the plugin manager decide.
  }
  if (latest && compareVersions(latest, current) <= 0) {
    return `Đã là bản mới nhất (v${current}).`
  }
  const outputs: string[] = []
  for (const args of [
    ['plugin', 'marketplace', 'update', MARKETPLACE],
    ['plugin', 'update', PLUGIN_ID],
  ]) {
    const run = await $.process.run(['claude', ...args], { timeoutMs: 120000 })
    const out = `${run.stdout}${run.stderr}`.trim()
    if (run.exitCode !== 0) {
      return `✗ 'claude ${args.join(' ')}' thất bại (mã ${run.exitCode})${out ? `:\n${out}` : ''}`
    }
    if (out) outputs.push(out)
  }
  // The new version is only on disk: have the engine re-read plugins once this command has returned.
  $.clock.after(500, () => void $.command.run({ command: 'reload-plugins' }).catch(() => undefined))
  return [
    ...outputs,
    `✓ v${current} → ${latest ?? 'bản mới nhất'}`,
    '🔄 Đang nạp lại plugin (/reload-plugins)...',
  ].join('\n')
}

async function helpText($: EngineInterface) {
  const s = await read($, settings)
  const toggles = (Object.keys(SETTING_INFO) as (keyof Settings)[]).map(
    key => `  ${key.padEnd(9)}${s[key] ? '[bật] ' : '[tắt] '}${SETTING_INFO[key]}`,
  )
  return [
    'Cách dùng: /mods <lệnh>',
    'Bảng:',
    '  sessions  các session Claude đang chạy trên máy (nhắn tin, copy lệnh resume)',
    '  dash      bảng hoạt động: subagent, git, tốc độ, file đã sửa (bấm để xem diff), tool',
    '  prompts   prompt nhanh: bấm để gửi',
    '  save <x>  lưu x thành một prompt nhanh',
    'Phiên bản:',
    '  version   phiên bản đang dùng và tag mới nhất',
    '  update    cập nhật lên tag mới nhất rồi tự /reload-plugins',
    'Bật/tắt (giữ qua các session):',
    ...toggles,
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    // `/mods` first and alone: nothing after it may take the command down.
    try {
      await $.command.register({
        name: 'mods',
        description: 'Giao diện: sessions, dash, prompts, save, version, update, và bật/tắt từng tính năng',
        argumentHint:
          'sessions | dash | prompts | save <prompt> | version | update | band | cards | tldr | notify | sound | voice | guard | decor',
      })
    } catch {
      $.ui.toast('terminal-polish: không đăng ký được /mods')
    }
    try {
      await loadSettings($)
    } catch {
      // Defaults stay.
    }
    try {
      await update($, project, () => '')
      const root = baseName(await $.session.root())
      await update($, project, () => root)
    } catch {
      // The band falls back to its own label.
    }
    await refreshGit($)
    await refreshUsage($)
    try {
      const home = (await $.process.run(['printenv', 'HOME'])).stdout.trim()
      const selfId = await $.session.id()
      const dir = `${home}/.claude/sessions`
      await refreshPeers($, dir, selfId)
      $.clock.every(POLL_MS, () => {
        void refreshPeers($, dir, selfId)
        void refreshAgents($)
      })
    } catch {
      // No sessions list; the rest of the mod runs.
    }

    return ran
  })

  on('command.run', { command: 'mods' }, async ($, e) => {
    const args = e.args.trim()
    const word = args.split(/\s+/)[0] ?? ''
    switch (word) {
      case 'sessions':
        return placed(await openPeers($), 'Đã mở danh sách session.')
      case 'dash':
        return placed(await openDash($), 'Đã mở bảng hoạt động.')
      case 'prompts':
        return placed(await openPrompts($), 'Đã mở prompt nhanh.')
      case 'version':
        return { text: await versionText($) }
      case 'update':
        return { text: await updatePlugin($) }
      case 'save': {
        const text = args.slice(word.length).trim()
        if (!text) return { text: 'Cách dùng: /mods save <nội dung prompt>' }
        await setPrompts($, list => [...list.filter(p => p !== text), text].slice(-30))
        return { text: `Đã lưu prompt nhanh: ${text}` }
      }
      default: {
        if (!isSettingKey(word)) return { text: await helpText($) }
        const s = await read($, settings)
        const next = await setSetting($, word, !s[word])
        return { text: `${SETTING_INFO[word]}: ${next[word] ? 'BẬT' : 'TẮT'}` }
      }
    }
  })

  on('turn.start', async ($, e, next) => {
    const value: Turn = { tools: 0, failed: 0 }
    await update($, turn, () => value)
    return next(e)
  })

  // Bookkeeping: fails open, a fault here never blocks a tool.
  on('tool.call', async ($, e, next) => {
    const path = e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'Read' ? e.file_path : undefined
    const label = e.tool === 'Bash' ? (e.command.split('\n')[0] ?? '') : path ? baseName(path) : ''
    const call: Call = { id: e.tool_use_id, tool: e.tool, label, state: 'run' }
    await update($, calls, list => [...list, call].slice(-100))
    await update($, turn, t => (t ? { ...t, tools: t.tools + 1 } : t))

    const ran = await next(e)
    const isFailed = ran.deny !== undefined || ran.isError === true
    await update($, calls, list =>
      list.map(one => (one.id === call.id ? { ...one, state: isFailed ? ('fail' as const) : ('ok' as const) } : one)),
    )
    if (isFailed) {
      await update($, turn, t => (t ? { ...t, failed: t.failed + 1 } : t))
    }
    if (!isFailed && path && e.tool !== 'Read') {
      await update($, files, list => [path, ...list.filter(f => f !== path)].slice(0, 30))
    }

    return ran
  }).catch(($, e, next) => next(e))

  // Guard: fails closed, a fault here denies rather than waves through.
  const guard = (reason: string) => ({
    deny: `terminal-polish đã chặn: ${reason}. Hỏi người dùng; họ có thể tự chạy lệnh hoặc tắt bằng /mods guard.`,
  })
  const guardFailed = { deny: 'terminal-polish: bộ chặn lỗi, đã chặn cho an toàn.' }

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const reason = (await read($, settings)).guard ? dangerOf(e.command) : undefined
    if (!reason) return next(e)
    $.ui.toast(`🛡 Đã chặn: ${reason}`)
    return guard(reason)
  }).catch(($, e, next) => (next.called ? next(e) : guardFailed))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    if (!(await read($, settings)).guard || !isSecretFile(e.file_path)) return next(e)
    $.ui.toast(`🛡 Đã chặn sửa ${baseName(e.file_path)}`)
    return guard(`sửa file bí mật ${baseName(e.file_path)}`)
  }).catch(($, e, next) => (next.called ? next(e) : guardFailed))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    if (!(await read($, settings)).guard || !isSecretFile(e.file_path)) return next(e)
    $.ui.toast(`🛡 Đã chặn ghi ${baseName(e.file_path)}`)
    return guard(`ghi file bí mật ${baseName(e.file_path)}`)
  }).catch(($, e, next) => (next.called ? next(e) : guardFailed))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    const ran = await next(e)
    const s = await read($, settings)
    const t = await read($, turn)
    const done: LastTurn = { seconds: Math.round(e.durationMs / 1000), tools: t?.tools ?? 0, failed: t?.failed ?? 0 }
    await update($, last, () => done)
    await update($, history, list => [...list, done].slice(-20))
    await update($, turn, () => null)

    const summary = `Xong sau ${duration(e.durationMs)} · ${done.tools} tool${done.failed ? ` · ${done.failed} lỗi` : ''}`
    if (done.seconds >= TOAST_SECONDS) $.ui.toast(`✓ ${summary}`)
    if (done.seconds >= NOTIFY_SECONDS && !e.isAborted) {
      const title = (await read($, project)) || 'Claude'
      if (s.notify) void $.ui.notify(summary, { title }).catch(() => undefined)
      if (s.sound) void $.audio.play({ asset: 'sounds/done.wav' }).catch(() => undefined)
      if (s.voice) void $.audio.speak('Claude đã xong').catch(() => undefined)
    }
    await refreshGit($)
    await refreshUsage($)

    if (s.tldr && e.reason === 'answer' && !e.isAborted && e.answer.length >= TLDR_MIN_CHARS) {
      const reply = await $.model.complete({
        model: 'haiku',
        maxTokens: 200,
        timeoutMs: 8000,
        system:
          'Tóm tắt câu trả lời sau trong tối đa hai câu ngắn, cùng ngôn ngữ với nó. Chỉ viết phần tóm tắt, không mở đầu.',
        prompt: e.answer.slice(0, 20000),
      })
      if (reply.isAnswered && reply.text.trim()) {
        return { ...ran, text: `TL;DR: ${reply.text.trim()}` }
      }
    }

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, settings)
    if (e.props.hasSurvey || !s.band) {
      return next(e)
    }
    const { Box, Text, Button } = $.ui.resolve(e)
    const name = await read($, project)
    const repo = await read($, git)
    const now = await read($, turn)
    const prev = await read($, last)
    const use = await read($, usage)
    const pct = use?.percent ?? null

    return (
      <Box flexDirection="row" flexWrap="wrap" width={e.props.bodyColumns} justifyContent="space-between" columnGap={2}>
        <Box flexDirection="row" flexShrink={1}>
          <Text color="claude" bold>
            ◆ {name || 'claude'}
          </Text>
          {repo && (
            <Text color="subtle" wrap="truncate-end">
              {'  ⎇ '}
              {repo.branch}
              {repo.changed > 0 ? ` ±${repo.changed}` : ' ✓'}
            </Text>
          )}
          <Text color="subtle">{'  │ '}</Text>
          {e.props.isWorking && now ? (
            <Text color="warning" wrap="truncate-end">
              ● đang chạy · {now.tools} tool{now.failed > 0 ? ` · ${now.failed} lỗi` : ''}
            </Text>
          ) : prev ? (
            <Text color={prev.failed > 0 ? 'error' : 'success'} wrap="truncate-end">
              {prev.failed > 0 ? '✗' : '✓'} {prev.seconds}s · {prev.tools} tool
              {prev.failed > 0 ? ` · ${prev.failed} lỗi` : ''}
            </Text>
          ) : (
            <Text color="subtle">sẵn sàng</Text>
          )}
          {pct !== null && (
            <Text color={pct >= 80 ? 'error' : pct >= 60 ? 'warning' : 'subtle'}>
              {'  │ ctx '}
              {pct}%
            </Text>
          )}
          {use?.usd != null && <Text color="subtle"> ${use.usd.toFixed(2)}</Text>}
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="sessions" label="Session" hotkey="s" dimColor onPress={() => void openPeers($)} />
          <Button key="dash" label="Bảng" hotkey="d" dimColor onPress={() => void openDash($)} />
          <Button key="prompts" label="Prompt" hotkey="p" dimColor onPress={() => void openPrompts($)} />
          <Button key="hide" label="Ẩn" hotkey="h" dimColor onPress={() => setSetting($, 'band', false)} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: DASH }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, calls)
    const touched = await read($, files)
    const repo = await read($, git)
    const subs = await read($, agents)
    const turns = await read($, history)
    const room = Math.max(3, (e.viewport?.rows ?? 24) - 14 - Math.min(touched.length, 8) - subs.length)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns} gap={1}>
        {subs.length > 0 && (
          <Box flexDirection="column">
            <Text color="claude" bold>
              Subagent ({subs.length})
            </Text>
            {subs.map(a => (
              <Text
                color={
                  a.status === 'running'
                    ? 'warning'
                    : a.status === 'failed' || a.status === 'killed'
                      ? 'error'
                      : 'subtle'
                }
                wrap="truncate-end"
              >
                {a.status === 'running' ? '● ' : a.status === 'completed' ? '✓ ' : '○ '}
                {a.label} · {a.status}
              </Text>
            ))}
          </Box>
        )}
        <Box flexDirection="column">
          <Text color="claude" bold>
            Git
          </Text>
          <Text color="subtle" wrap="truncate-end">
            {repo ? `⎇ ${repo.branch} · ${repo.changed} file thay đổi` : 'không phải git repo'}
          </Text>
        </Box>
        {turns.length > 0 && (
          <Box flexDirection="column">
            <Text color="claude" bold>
              Tốc độ {turns.length} lượt gần đây
            </Text>
            <Text color="suggestion">
              {spark(turns.map(t => t.seconds))}
              <Text color="subtle"> max {Math.max(...turns.map(t => t.seconds))}s</Text>
            </Text>
          </Box>
        )}
        <Box flexDirection="column">
          <Text color="claude" bold>
            File đã sửa ({touched.length}) · bấm để xem diff
          </Text>
          {touched.length === 0 && <Text color="subtle">chưa có</Text>}
          {touched.slice(0, 8).map(f => (
            <Button key={`diff-${f}`} label={`✎ ${baseName(f)}`} plain onPress={() => void showDiff($, f)} />
          ))}
        </Box>
        <Box flexDirection="column">
          <Text color="claude" bold>
            Tool gần đây ({list.length})
          </Text>
          {list.length === 0 && <Text color="subtle">chưa có</Text>}
          {list
            .slice(-room)
            .reverse()
            .map(call => (
              <Text color={COLOR[call.state]} bold={call.state === 'run'} wrap="truncate-end">
                {`${ICON[call.state]} ${call.tool}  ${call.label}`}
              </Text>
            ))}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: DIFF_PANE }, async ($, e) => {
    const { Box, Text, Code } = $.ui.resolve(e)
    const shown = await read($, diff)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        {!shown && <Text color="subtle">Chọn một file trong /mods dash để xem diff.</Text>}
        {shown && (
          <Text color="subtle" wrap="truncate-start">
            {shown.path}
          </Text>
        )}
        {shown?.note && <Text color="warning">{shown.note}</Text>}
        {shown?.text && <Code source={shown.text} format="diff" path={shown.path} />}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PEERS_PANE }, async ($, e) => {
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const list = await read($, peers)
    const busy = list.filter(p => p.status === 'busy').length

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color="subtle">
          {list.length} session · {busy} đang chạy · ctrl+x tab để gõ
        </Text>
        {list.length === 0 && <Text color="subtle">không tìm thấy session nào</Text>}
        {list.map(peer => (
          <Box key={`peer-${peer.id}`} flexDirection="column" marginTop={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={peer.isSelf ? 'claude' : 'text'} bold={peer.isSelf} wrap="truncate-end">
                {peer.isSelf ? '★ ' : '  '}
                {peer.name}
              </Text>
              <Text color={peer.status === 'busy' ? 'warning' : 'success'}>
                {peer.status === 'busy' ? '● bận' : '○ rảnh'}
              </Text>
            </Box>
            <Text color="subtle" wrap="truncate-start">
              {'  '}
              {peer.cwd}
            </Text>
            {!peer.isSelf && (
              <Box flexDirection="column">
                {Input && (
                  <Input
                    key={`send-${peer.id}`}
                    placeholder="Nhắn cho session này…"
                    submitLabel="Gửi"
                    onSubmit={text => {
                      if (!text.trim()) return
                      void $.session
                        .send({ to: { sessionId: peer.id }, text })
                        .then(r =>
                          $.ui.toast(r.isDelivered ? `✓ Đã gửi tới ${peer.name}` : `✗ Không gửi được: ${r.reason}`),
                        )
                        .catch(() => $.ui.toast(`✗ Không gửi được tới ${peer.name}`))
                    }}
                  />
                )}
                <Button
                  key={`resume-${peer.id}`}
                  label="Copy lệnh resume"
                  dimColor
                  onPress={() => void $.ui.copy({ text: `cd ${peer.cwd} && claude --resume ${peer.id}` })}
                />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PROMPTS_PANE }, async ($, e) => {
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const list = await read($, prompts)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color="subtle">Bấm để gửi; đang bận thì xếp hàng chạy sau. ctrl+x tab để gõ.</Text>
        {list.length === 0 && (
          <Text color="subtle">Chưa có prompt nào. Thêm ở ô dưới hoặc /mods save &lt;prompt&gt;.</Text>
        )}
        {list.map((text, i) => (
          <Box key={`prompt-${i}`} flexDirection="row" gap={1}>
            <Button
              key={`run-${i}`}
              label={text.length > 60 ? `${text.slice(0, 59)}…` : text}
              hotkey={i < 9 ? String(i + 1) : undefined}
              onPress={() => {
                void $.prompt.submit({ text })
                $.ui.toast('Đã xếp hàng prompt')
              }}
            />
            <Button
              key={`del-${i}`}
              label="✕"
              dimColor
              onPress={() => void setPrompts($, l => l.filter(p => p !== text))}
            />
          </Box>
        ))}
        {Input && (
          <Input
            key="new-prompt"
            placeholder="Thêm prompt nhanh…"
            submitLabel="Lưu"
            onSubmit={text => {
              const value = text.trim()
              if (value) void setPrompts($, l => [...l.filter(p => p !== value), value].slice(-30))
            }}
          />
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'composer' } } }, async ($, e, next) => {
    if (!(await read($, settings)).cards) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box borderStyle="round" borderColor="claude" paddingX={1} flexDirection="row">
        <Text color="claude" bold>
          ❯{' '}
        </Text>
        <Text>{e.props.text}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!(await read($, settings)).decor) return next(e)
    return next({ ...e, props: { ...e.props, word: SPINNER_WORDS[e.props.mode] } })
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!(await read($, settings)).decor || e.props.isDraft) return next(e)
    return next({ ...e, props: { ...e.props, tail: '· /mods ⚙' } })
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (!(await read($, settings)).decor) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text color="subtle">✓ Xong sau {duration(e.props.durationMs)}</Text>
  })
}
