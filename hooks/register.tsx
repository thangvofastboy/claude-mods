import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type {
  Account,
  Agent,
  AgentStat,
  Blast,
  Breakdown,
  Call,
  CheckResult,
  Checkpoint,
  CommitDraft,
  Diff,
  Found,
  Git,
  LastTurn,
  Limit,
  Notice,
  Peer,
  Settings,
  SplashInfo,
  Step,
  TimerState,
  Todo,
  Turn,
  Usage,
} from '../types'

const DASH = 'terminal-polish-dash'
const PEERS_PANE = 'terminal-polish-sessions'
const DIFF_PANE = 'terminal-polish-diff'
const PROMPTS_PANE = 'terminal-polish-prompts'
const SETTINGS_PANE = 'terminal-polish-settings'
const SELECTION_PANE = 'terminal-polish-selection'
const FIND_PANE = 'terminal-polish-find'
const TODO_PANE = 'terminal-polish-todo'
const NOTES_PANE = 'terminal-polish-notes'
const COMMIT_PANE = 'terminal-polish-commit'
const CONTEXT_PANE = 'terminal-polish-context'
const ACCOUNTS_PANE = 'terminal-polish-accounts'
const REPLAY_PANE = 'terminal-polish-replay'
const MONITOR_PANE = 'terminal-polish-monitor'
// Not `!`: a leading `!` in the composer runs a shell command and never reaches prompt.submit.
const BYPASS = '>>'
const MAX_CHECKPOINTS = 50
const COMPACT_PERCENT = 85
const COLLAPSE_LINES = 3
const NOTIFY_TOOL = 'mcp__terminal-polish__notify_me'
const STATS_DAYS = 60
const POLL_MS = 3000
const TOAST_SECONDS = 60
const NOTIFY_SECONDS = 20
// A turn that runs this long gets one reminder (under the notify setting).
const LONG_TURN_MS = 5 * 60_000
const TLDR_MIN_CHARS = 1200
const REPO = 'git@github.com:thangvofastboy/claude-mods.git'
const MARKETPLACE = 'claude-mods'
const PLUGIN_ID = `terminal-polish@${MARKETPLACE}`

const DEFAULTS: Settings = {
  band: true,
  cards: true,
  frame: true,
  tldr: true,
  notify: true,
  sound: false,
  voice: false,
  guard: true,
  decor: true,
  quota: true,
  autocompact: false,
  abbrev: true,
  rules: true,
  tools: true,
  automodel: false,
  journal: true,
  collapse: true,
  badges: true,
  gradient: true,
  powerline: false,
  compact: false,
  weather: true,
  blast: true,
  fun: true,
  ctxwarn: true,
  meters: true,
  statecolor: true,
  fileicons: true,
  anim: true,
  confetti: true,
  splash: true,
  splashhide: false,
  heatmap: true,
  hovercards: true,
  images: true,
  secrets: true,
  budget: true,
  checkpoints: true,
  branchlock: false,
  format: false,
  autocheck: false,
  compactplus: true,
  todos: true,
  notices: true,
  autoupdate: true,
  msgactions: true,
  asknotify: true,
  quiet: false,
  quotaalert: true,
  testfail: true,
  relatedtest: false,
  promptlint: true,
  shadow: false,
}
const SETTING_INFO: Record<keyof Settings, string> = {
  band: 'dải trạng thái trên ô prompt',
  cards: 'ngoặc bo tròn bên trái tin nhắn của bạn (khi tắt `frame`)',
  frame: 'khung bo tròn bao quanh tin nhắn của bạn, dễ nhận ra hơn ngoặc bên trái',
  tldr: 'TL;DR dưới câu trả lời dài (tốn thêm token haiku)',
  notify: 'báo khi lượt dài xong (thẻ trên dải trạng thái và thông báo hệ điều hành), và nhắc một lần khi lượt chạy quá 5 phút',
  sound: 'âm thanh khi lượt dài xong',
  voice: 'đọc to khi lượt dài xong',
  guard: 'lệnh nguy hiểm và sửa/ghi file bí mật: hỏi bạn trong hộp thoại quyền trước khi chạy, không có ai để hỏi thì chặn',
  decor: 'spinner, dòng gợi ý và dòng thời gian kiểu mới',
  quota: 'thanh quota 5h/7d trên dải trạng thái',
  autocompact: `tự /compact khi context từ ${COMPACT_PERCENT}% (tắt: chỉ nhắc nếu bật ctxwarn)`,
  ctxwarn: `nhắc /compact khi context từ ${COMPACT_PERCENT}%`,
  abbrev: 'bung từ viết tắt ;xxx trong prompt',
  rules: 'thêm luật của dự án vào system prompt',
  tools: 'tool notify_me và subagent reviewer/tester cho Claude (áp dụng khi nạp lại)',
  automodel: 'tự chọn model và effort cho từng lượt và từng subagent: Haiku/low cho việc nhẹ, Sonnet/medium cho code, Opus/high cho review, thiết kế, debug (thử nghiệm)',
  journal: 'ghi nhật ký khi đóng session vào ~/.claude/mods-journal.md',
  collapse: 'thu gọn output Bash dài còn 3 dòng',
  badges: 'badge màu cho từng dòng tool',
  gradient: 'chữ chuyển màu cho tên dự án và tiêu đề',
  powerline: 'dải trạng thái kiểu powerline (cần font Nerd Font)',
  compact: 'dải trạng thái gọn 1 hàng (tắt: 2 hàng, thanh đo ở hàng riêng)',
  weather: 'thời tiết context ☀☁☂☇↯ và số token lượt trước thêm vào',
  fun: 'câu đùa ngẫu nhiên cạnh spinner và dự báo hài cho hôm nay (/mods vui)',
  blast: 'giữ lệnh rủi ro (rm -r, git reset --hard, clean, force-push), cho xem sẽ thay đổi gì rồi bấm 1 chạy / 2 hủy',
  meters: 'thanh đo màu ▰▰▱ cho context và quota',
  statecolor: 'viền dải trạng thái đổi màu theo trạng thái',
  fileicons: 'nhãn màu theo loại file trong bảng hoạt động',
  anim: 'vệt sáng khi Claude đang làm (terminal), hình nền động của theme (desktop)',
  confetti: 'thông báo "Test pass!" và pháo hoa khi test pass hoặc xong việc dài (pháo hoa chỉ ở terminal)',
  splash: 'màn chào khi mở session',
  splashhide: 'tự ẩn màn chào khi gửi prompt đầu tiên (tắt: màn chào giữ nguyên)',
  heatmap: 'heatmap hoạt động 8 tuần trong bảng hoạt động',
  hovercards: 'đổi màu dòng khi rê chuột (fullscreen)',
  images: 'ảnh logo ở màn chào và thumbnail ảnh đã paste (kitty/Ghostty; nút mở ảnh luôn có)',
  secrets: 'chặn prompt có API key, token, private key (gửi lại với >> ở đầu để vẫn gửi)',
  budget: 'giới hạn chi tiêu theo ngày đặt bằng /mods budget',
  checkpoints: 'lưu bản cũ trước khi Claude sửa file (/mods undo)',
  branchlock: 'chặn commit/push thẳng lên main, master, production',
  format: 'tự format file sau khi Claude sửa (prettier, ruff, gofmt, rustfmt)',
  autocheck: 'tự chạy lệnh kiểm tra (/mods check) sau lượt có sửa file',
  compactplus: 'giữ file đã sửa, luật và TODO khi /compact',
  todos: 'gom TODO/FIXME và checklist vào bảng TODO',
  notices: 'thẻ thông báo có màu và viền trên dải trạng thái',
  autoupdate: 'tự cập nhật plugin lên tag mới nhất khi mở Claude (kiểm tra tối đa 6 giờ một lần, chỉ bản cài từ marketplace)',
  msgactions: 'icon dưới tin nhắn bạn đã gửi: 📋 sao chép, ⭐ lưu vào Prompt nhanh, 🔄 gửi lại khi lượt lỗi, 📝 sửa và 🛑 huỷ (lượt đang chạy); nút sao chép từng code block và 🔗 mở link (trình duyệt) / file (ứng dụng mặc định) dưới câu trả lời',
  asknotify: 'báo khi Claude hỏi bạn (AskUserQuestion), để bạn làm việc khác',
  quiet: 'giờ yên lặng 22h–8h: không thông báo hệ điều hành, không âm thanh, không đọc to',
  quotaalert: 'cảnh báo khi giới hạn 5h hoặc 7d đã dùng từ 90%, kèm giờ reset',
  testfail: 'dải trạng thái hiện tên test lỗi đầu tiên sau lệnh test thất bại',
  relatedtest: 'sau mỗi lần sửa file, chạy test liên quan (vitest hoặc jest), tốn thời gian',
  promptlint: 'nhắc khi prompt ngắn chỉ nói "nó", "cái này"… mà không nêu file hay mục tiêu (không chặn gửi)',
  shadow: 'sau mỗi lượt có sửa file, lưu một commit nháp vào refs/mods/turns (không đụng nhánh, index hay HEAD); xem bằng /mods turns',
}
const isSettingKey = (word: string): word is keyof Settings => word in DEFAULTS
// The settings tab's groups; anything not listed falls into "Khác".
const SETTING_GROUPS: Record<string, (keyof Settings)[]> = {
  'Giao diện': [
    'band',
    'cards',
    'frame',
    'decor',
    'quota',
    'gradient',
    'powerline',
    'compact',
    'weather',
    'meters',
    'statecolor',
    'fileicons',
    'badges',
    'collapse',
    'splash',
    'splashhide',
    'heatmap',
    'hovercards',
    'images',
    'notices',
  ],
  'Hiệu ứng': ['anim', 'confetti', 'fun', 'sound', 'voice'],
  'An toàn': ['guard', 'blast', 'secrets', 'budget', 'checkpoints', 'branchlock', 'shadow'],
  'Tiện ích': ['tldr', 'notify', 'ctxwarn', 'autocompact', 'abbrev', 'rules', 'tools', 'journal', 'compactplus', 'todos', 'msgactions', 'asknotify', 'quiet', 'quotaalert', 'testfail', 'relatedtest', 'promptlint'],
  'Tự động': ['format', 'autocheck', 'autoupdate'],
  'Thử nghiệm': ['automodel'],
}
// Left out of "Bật hết": turned on one at a time, knowingly.
const EXPERIMENTAL = new Set<keyof Settings>(['automodel'])

const settings = atom({ plugin: 'terminal-polish', key: 'settings' } as const, DEFAULTS)
const project = atom({ plugin: 'terminal-polish', key: 'project' } as const, '')
const git = atom({ plugin: 'terminal-polish', key: 'git' } as const, null)
const turn = atom({ plugin: 'terminal-polish', key: 'turn' } as const, null)
const liveTurn = atom({ plugin: 'terminal-polish', key: 'liveTurn' } as const, null)
// The prompt of the last turn that ended in an API error, for the ↻ resend button.
const failed = atom({ plugin: 'terminal-polish', key: 'failed' } as const, null)
const last = atom({ plugin: 'terminal-polish', key: 'last' } as const, null)
const history = atom({ plugin: 'terminal-polish', key: 'history' } as const, [])
const usage = atom({ plugin: 'terminal-polish', key: 'usage' } as const, null)
const calls = atom({ plugin: 'terminal-polish', key: 'calls' } as const, [])
const files = atom({ plugin: 'terminal-polish', key: 'files' } as const, [])
const peers = atom({ plugin: 'terminal-polish', key: 'peers' } as const, [])
const agents = atom({ plugin: 'terminal-polish', key: 'agents' } as const, [])
const diff = atom({ plugin: 'terminal-polish', key: 'diff' } as const, null)
const prompts = atom({ plugin: 'terminal-polish', key: 'prompts' } as const, [])
const root = atom({ plugin: 'terminal-polish', key: 'root' } as const, '')
const home = atom({ plugin: 'terminal-polish', key: 'home' } as const, '')
const startedAt = atom({ plugin: 'terminal-polish', key: 'startedAt' } as const, 0)
const totals = atom({ plugin: 'terminal-polish', key: 'totals' } as const, { turns: 0, seconds: 0, tools: 0 })
const lastUsd = atom({ plugin: 'terminal-polish', key: 'lastUsd' } as const, null)
const ctxWarned = atom({ plugin: 'terminal-polish', key: 'ctxWarned' } as const, false)
const rules = atom({ plugin: 'terminal-polish', key: 'rules' } as const, [])
const selection = atom({ plugin: 'terminal-polish', key: 'selection' } as const, null)
const found = atom({ plugin: 'terminal-polish', key: 'found' } as const, [])
const query = atom({ plugin: 'terminal-polish', key: 'query' } as const, '')
const timer = atom({ plugin: 'terminal-polish', key: 'timer' } as const, null)
const expanded = atom({ plugin: 'terminal-polish', key: 'expanded' } as const, [])
const autoModel = atom({ plugin: 'terminal-polish', key: 'autoModel' } as const, null)
const autoEffort = atom({ plugin: 'terminal-polish', key: 'autoEffort' } as const, null)
const notices = atom({ plugin: 'terminal-polish', key: 'notices' } as const, [])
const openCalls = atom({ plugin: 'terminal-polish', key: 'openCalls' } as const, [])
const theme = atom({ plugin: 'terminal-polish', key: 'theme' } as const, 'auto')
const fx = atom({ plugin: 'terminal-polish', key: 'fx' } as const, null)
const splash = atom({ plugin: 'terminal-polish', key: 'splash' } as const, false)
const splashInfo = atom({ plugin: 'terminal-polish', key: 'splashInfo' } as const, null)
const heat = atom({ plugin: 'terminal-polish', key: 'heat' } as const, {})
const checkpoints = atom({ plugin: 'terminal-polish', key: 'checkpoints' } as const, [])
const todos = atom({ plugin: 'terminal-polish', key: 'todos' } as const, [])
const notes = atom({ plugin: 'terminal-polish', key: 'notes' } as const, [])
const accounts = atom({ plugin: 'terminal-polish', key: 'accounts' } as const, null)
const replay = atom({ plugin: 'terminal-polish', key: 'replay' } as const, [])
const replayCount = atom({ plugin: 'terminal-polish', key: 'replayCount' } as const, 0)
const agentStats = atom({ plugin: 'terminal-polish', key: 'agentStats' } as const, [])
const replayAt = atom({ plugin: 'terminal-polish', key: 'replayAt' } as const, 0)
const commitDraft = atom({ plugin: 'terminal-polish', key: 'commitDraft' } as const, null)
const check = atom({ plugin: 'terminal-polish', key: 'check' } as const, null)
const checkCommand = atom({ plugin: 'terminal-polish', key: 'checkCommand' } as const, '')
const breakdown = atom({ plugin: 'terminal-polish', key: 'breakdown' } as const, null)
const budgetWarned = atom({ plugin: 'terminal-polish', key: 'budgetWarned' } as const, '')
const spentToday = atom({ plugin: 'terminal-polish', key: 'spentToday' } as const, 0)
const budgetLimit = atom({ plugin: 'terminal-polish', key: 'budgetLimit' } as const, 0)
const blast = atom({ plugin: 'terminal-polish', key: 'blast' } as const, null)
const testFail = atom({ plugin: 'terminal-polish', key: 'testFail' } as const, null as string | null)
const lastAnswer = atom({ plugin: 'terminal-polish', key: 'lastAnswer' } as const, '')
const quotaWarned = atom({ plugin: 'terminal-polish', key: 'quotaWarned' } as const, '')

const ICON = { run: '◌', ok: '✓', fail: '✗' } as const
const AGENT_STATUS: Record<string, string> = {
  pending: 'chờ',
  running: 'đang chạy',
  waiting: 'đang đợi',
  idle: 'rảnh',
  completed: 'xong',
  failed: 'lỗi',
  killed: 'đã dừng',
}
const STATE_ROLE = { run: 'warn', ok: 'ok', fail: 'err' } as const
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
//
// rm and git push are read as shell segments and words, not matched with one
// big regex: the work is linear in the command's length (no backtracking
// blow-up on a crafted command), and flags in any order or place
// (--no-preserve-root, --, -r -f) cannot walk a target past the check.
const SIMPLE_DANGER: readonly [RegExp, string][] = [
  [/\bmkfs(\.\w+)?\s/, 'format ổ đĩa'],
  [/\bdd\s[^;&|\n]*\bof=\/dev\/(sd|nvme|hd|mmcblk)/, 'ghi đè thẳng lên ổ đĩa'],
  [/\bchmod\s+-R\s+777\s+\/(\s|$)/, 'chmod 777 toàn hệ thống'],
]

const SEGMENT = /\r\n|\r|\n|&&|\|\||[;&|]/
// Each word as the shell runs it: quotes and backslashes removed anywhere in
// it (\rm, r''m and "$HOME"/ are rm and $HOME/), then the edges of $(…), (…), `…`.
const bare = (word: string) =>
  word
    .replace(/["'\\]/g, '')
    .replace(/^(?:\$\(|\(|`)+/, '')
    .replace(/(?:\)|`)+$/, '')
const shellSegments = (command: string) =>
  command
    .split(SEGMENT)
    .map(seg => seg.trim().split(/\s+/).map(bare).filter(Boolean))
    .filter(words => words.length > 0)

const RM_TARGETS = new Set([
  '/',
  '/*',
  '/.',
  '~',
  '~/',
  '~/*',
  '*',
  '.*',
  '$HOME',
  '$HOME/',
  '$HOME/*',
  '${HOME}',
  '${HOME}/',
  '${HOME}/*',
])

// The words after `rm`: is it recursive, and what does it remove.
function rmArgs(args: string[]) {
  let recursive = false
  let endOfFlags = false
  const targets: string[] = []
  for (const w of args) {
    if (!endOfFlags && w === '--') endOfFlags = true
    else if (!endOfFlags && w.startsWith('--')) recursive ||= w === '--recursive'
    else if (!endOfFlags && /^-[a-zA-Z]+$/.test(w)) recursive ||= /[rR]/.test(w)
    else targets.push(w)
  }
  return { recursive, targets }
}

function rmDanger(words: string[]) {
  const at = words.findIndex(w => w === 'rm' || w.endsWith('/rm'))
  if (at < 0) return false
  const { recursive, targets } = rmArgs(words.slice(at + 1))
  return recursive && targets.some(t => RM_TARGETS.has(t))
}

// `git [global options] <sub> <args>`: -C and -c take a value, other leading flags are skipped.
const GIT_VALUE_OPTIONS = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--config-env',
  '--exec-path',
])

function gitCommand(words: string[]) {
  const at = words.findIndex(w => w === 'git' || w.endsWith('/git'))
  if (at < 0) return undefined
  for (let i = at + 1; i < words.length; i++) {
    const w = words[i] ?? ''
    if (GIT_VALUE_OPTIONS.has(w)) i++
    else if (!w.startsWith('-')) return { sub: w, args: words.slice(i + 1) }
  }
  return undefined
}

// The branch a refspec writes to: `+main`, `HEAD:main`, `refs/heads/main` → main.
const pushTarget = (ref: string) => (ref.replace(/^\+/, '').split(':').pop() ?? '').replace(/^refs\/heads\//, '')

function forcePushDanger(words: string[]) {
  const git = gitCommand(words)
  if (git?.sub !== 'push') return false
  let force = false
  const refs: string[] = []
  for (const w of git.args) {
    if (w === '--force' || w.startsWith('--force=')) force = true
    else if (/^-[a-zA-Z]+$/.test(w) && w.includes('f')) force = true
    else if (!w.startsWith('-')) refs.push(w)
  }
  // refs[0] is the remote; a `+ref` forces that ref alone.
  return refs.slice(1).some(r => ['main', 'master'].includes(pushTarget(r)) && (force || r.startsWith('+')))
}
const SECRET_FILE = /(^|\/)(\.env(\.[^/]*)?|id_rsa[^/]*|id_ed25519[^/]*|[^/]+\.pem)$/
const SECRET_TEMPLATE = /\.env\.(example|sample|template)$/

// A repository's own .git/config can name programs git runs (a filter's
// clean/smudge, fsmonitor, an external diff, a textconv, a pager). The mod runs
// git in whatever repo is open, so every call turns off what `-c` can, and
// git is not run at all where the repo's own config names any program
// (gitIsSafe); the person's global and system config are trusted. Submodules,
// whose config lives apart under .git/modules, are never entered.
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
  '^(filter\\..+\\.(clean|smudge|process)|diff\\.external|diff\\..+\\.(command|textconv)|merge\\..+\\.driver' +
  '|gpg(\\..+)?\\.program|gpg\\.ssh\\.defaultkeycommand|sequence\\.editor|uploadpack\\.packobjectshook|credential\\..*helper' +
  '|core\\.(fsmonitor|sshcommand|pager|hookspath|editor|askpass|gitproxy|alternaterefscommand))$'

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

// A command is shown whole: every line, joined by ⏎, never cut to its first
// line or truncated, so a row cannot show a harmless head and hide the rest.
// The dashboard's compact form: short, but never silently cut. A shortened
// label always ends in … and says how many more lines the command has, so a
// harmless head cannot pass for the whole command; ▸ opens it in full.
const SHORT_LABEL = 40
function shortLabel(label: string) {
  const parts = label.split(' ⏎ ')
  const head = parts[0] ?? ''
  const more = parts.length - 1
  if (more === 0 && head.length <= SHORT_LABEL) return { head: label, marker: '' }
  return {
    head: head.length > SHORT_LABEL ? head.slice(0, SHORT_LABEL - 1) : head,
    marker: `…${more ? ` (+${more} dòng)` : ''}`,
  }
}

// Split, not one regex with \s* on both sides of the newline: linear on any input.
const commandLabel = (command: string) =>
  command
    .split(/\r\n|\r|\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ⏎ ')

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

function dangerOf(command: string) {
  for (const words of shellSegments(command)) {
    if (rmDanger(words)) return 'xóa đệ quy /, ~ hoặc *'
    if (forcePushDanger(words)) return 'force-push lên main/master'
  }
  return SIMPLE_DANGER.find(([pattern]) => pattern.test(command))?.[1]
}

function isSecretFile(path: string) {
  return SECRET_FILE.test(path) && !SECRET_TEMPLATE.test(path)
}

function duration(ms: number) {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

// Every write redraws whatever reads the atom: hot writers skip a value that did not change.
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// What every drawing starts from, in one round trip.
const look = ($: EngineInterface) => Promise.all([palette($), read($, settings)])

async function setSettings($: EngineInterface, patch: Partial<Settings>) {
  const next = await update($, settings, s => ({ ...s, ...patch }))
  await $.store.set('settings', next)
  return next
}

const setSetting = ($: EngineInterface, key: keyof Settings, value: boolean) => setSettings($, { [key]: value })

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
      if (!same(await read($, git), null)) await update($, git, () => null)
      return
    }
    const [head, status] = await Promise.all([
      $.process.run([...SAFE_GIT, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 3000 }),
      $.process.run([...SAFE_GIT, 'status', '--porcelain', '--ignore-submodules=all'], { timeoutMs: 3000 }),
    ])
    if (head.exitCode !== 0) {
      if (!same(await read($, git), null)) await update($, git, () => null)
      return
    }
    const changed = status.stdout.split('\n').filter(Boolean).length
    const value: Git = { branch: head.stdout.trim(), changed }
    if (!same(await read($, git), value)) await update($, git, () => value)
  } catch {
    if (!same(await read($, git), null)) await update($, git, () => null)
  }
}

// session.usage() asks the rate-limit endpoint, which answers 429 when hit once per
// turn. Skip calls inside the wait; every failure doubles it, a success resets it.
const USAGE_MIN_MS = 30_000
const USAGE_MAX_BACKOFF_MS = 10 * 60_000
let usageNextAt = 0
let usageWait = USAGE_MIN_MS
let usageBusy = false

export async function refreshUsage($: EngineInterface, force = false) {
  if (usageBusy) return
  usageBusy = true
  try {
    // force skips the 30 s floor, never a failure backoff: a 429 run must not retry every turn.
    if ((!force || usageWait > USAGE_MIN_MS) && (await $.clock.now()) < usageNextAt) return
    try {
      await fetchUsage($)
      usageWait = USAGE_MIN_MS
    } catch {
      // Usage is decoration: the band keeps the last figure and we back off.
      usageWait = Math.min(usageWait * 2, USAGE_MAX_BACKOFF_MS)
    }
    usageNextAt = (await $.clock.now()) + usageWait
  } catch {
    // No clock: nothing to throttle with, the band simply leaves usage out.
  } finally {
    usageBusy = false
  }
}

async function fetchUsage($: EngineInterface) {
  const [u, before] = await Promise.all([$.session.usage(), read($, usage)])
  const tokens = u.context.tokens ?? null
  const value: Usage = {
    percent: u.context.percent ?? null,
    usd: u.cost?.usd ?? null,
    limits: u.rateLimits.map(l => ({
      kind: l.kind,
      percent: Math.round(l.percentUsed),
      ...(l.resetsAt ? { resetsAt: l.resetsAt } : {}),
    })),
    tokens,
    // Unchanged tokens keep the last turn's figure; a drop (/compact, /clear) clears it.
    added:
      tokens == null || before?.tokens == null
        ? null
        : tokens === before.tokens
          ? (before.added ?? null)
          : tokens > before.tokens
            ? tokens - before.tokens
            : null,
  }
  if (!same(before, value)) await update($, usage, () => value)
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
    if (!same(await read($, peers), found)) await update($, peers, () => found)
  } catch {
    if (!same(await read($, peers), [])) await update($, peers, () => [])
  }
}

const syncPeers = async ($: EngineInterface) => {
  const dir = await read($, home)
  if (dir) await refreshPeers($, `${dir}/.claude/sessions`, await $.session.id())
}

// True while an agent of this session may be running: set by a spawn, cleared by
// a list with none running.
let agentsLive = false

async function refreshAgents($: EngineInterface) {
  try {
    const found: Agent[] = (await $.agent.list())
      .slice(-50)
      .map(a => ({
        id: a.id,
        label: a.description || a.name || a.type,
        status: a.status,
        type: a.type,
        ...(a.parentId ? { parentId: a.parentId } : {}),
      }))
    agentsLive = agentSummary(found).running > 0
    if (!same(await read($, agents), found)) await update($, agents, () => found)
  } catch {
    // No agents noun answer: leave the last list.
  }
}

// Counts over every agent the session has run, not only the rows drawn.
export function agentSummary(list: { status: string }[]) {
  const count = (...words: string[]) => list.filter(a => words.includes(a.status)).length
  return {
    running: count('running', 'pending', 'waiting'),
    done: count('completed'),
    failed: count('failed', 'killed'),
    total: list.length,
  }
}

// Quota: 90% is the warning line; the window's key (kind and reset) keeps one alert per window.
const QUOTA_ALERT_PERCENT = 90
const PIN_MAX = 500

export const inQuiet = (hour: number) => hour >= 22 || hour < 8

export function formatReset(iso: string | undefined, now: number) {
  const at = iso ? Date.parse(iso) : Number.NaN
  if (Number.isNaN(at)) return 'chưa rõ'
  const min = Math.round((at - now) / 60000)
  if (min <= 0) return 'sắp reset'
  return min >= 60 ? `${Math.floor(min / 60)}h${min % 60}m` : `${min}m`
}

export function quotaAlert(limits: Limit[], warned: string, now: number) {
  const over = limits.filter(l => l.percent >= QUOTA_ALERT_PERCENT)
  const keys = over.map(l => `${l.kind}|${l.resetsAt ?? ''}`)
  const seen = warned.split('\n')
  const fresh = over.filter((_, i) => !seen.includes(keys[i] ?? ''))
  if (fresh.length === 0) return null
  return {
    keys: keys.join('\n'),
    text: fresh
      .map(l => `${LIMIT_LABEL[l.kind] ?? l.kind} đã dùng ${l.percent}% · reset sau ${formatReset(l.resetsAt, now)}`)
      .join(' · '),
  }
}

// The first failing test name in a runner's output; null when none is recognised.
export function failName(text: string): string | null {
  const patterns = [/FAIL\s+\S+\s+>\s+(.+)/, /^\s*●\s+(.+)$/m, /^FAILED\s+(\S+)/m, /--- FAIL: (\S+)/]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m?.[1]) return m[1].trim().slice(0, 80)
  }
  return null
}

// `--no-install`: a runner missing from node_modules is not fetched from the network.
export function relatedCommand(pkg: string, files: string[]): string[] | null {
  if (files.length === 0) return null
  if (/"vitest"/.test(pkg)) return ['npx', '--no-install', 'vitest', 'related', '--run', ...files]
  if (/"jest"/.test(pkg)) return ['npx', '--no-install', 'jest', '--findRelatedTests', ...files]
  return null
}

export function searchPrompts(texts: string[], query: string, limit = 10) {
  const q = query.toLowerCase()
  const hits = texts.map(t => t.trim()).filter(t => t && t.toLowerCase().includes(q))
  return [...new Set(hits)].reverse().slice(0, limit)
}

// User prompts from one Claude Code transcript (JSON lines); tool results carry no text block.
export function transcriptPrompts(lines: string[]) {
  const out: string[] = []
  for (const line of lines) {
    if (!line.includes('"type":"user"')) continue
    try {
      const row = JSON.parse(line) as { type?: string; message?: { content?: unknown } }
      if (row.type !== 'user') continue
      const c = row.message?.content
      if (typeof c === 'string') out.push(c)
      else if (Array.isArray(c))
        for (const b of c) if (b && typeof b === 'object' && (b as { type?: unknown }).type === 'text')
          out.push(String((b as { text?: unknown }).text ?? ''))
    } catch {
      // A partial line at the end of a file being written.
    }
  }
  return out
}

export function spendSince(stats: Record<string, Record<string, { usd: number }>>, days: string[]) {
  return days.reduce((n, day) => n + Object.values(stats[day] ?? {}).reduce((m, r) => m + r.usd, 0), 0)
}

export function prDraft(log: string, stat: string) {
  const commits = log.split('\n').filter(Boolean).map(l => `- ${l}`)
  return [
    '## Tóm tắt',
    ...(commits.length ? commits : ['- Chưa có commit mới so với nhánh gốc.']),
    '',
    '## Thay đổi',
    '```',
    stat.trim() || '(không có thay đổi file)',
    '```',
  ].join('\n')
}

// Fenced code blocks of a reply, in order: the language tag (may be empty) and the body.
export const codeBlocks = (text: string) =>
  [...text.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)].map(m => ({ lang: (m[1] ?? '').trim(), code: (m[2] ?? '').replace(/\n$/, '') }))

// Links and file paths a reply mentions, outside fenced code. A file counts only in `backticks` with an extension; a :line suffix is dropped.
export const linksOf = (text: string) => {
  const prose = text.replace(/```[\s\S]*?```/g, '')
  const urls = [...prose.matchAll(/https?:\/\/[^\s<>()`'"\]]+/g)].map(m => m[0].replace(/[.,;:!?*_]+$/, ''))
  const files = [...prose.matchAll(/`((?:~|\.{1,2})?\/?[\w.@-]+(?:\/[\w.@-]+)*\.\w+)(?::\d+(?::\d+)?)?`/g)]
    .map(m => m[1] ?? '')
    .filter(f => !/^https?:/.test(f))
  return [...new Set([...urls, ...files])].slice(0, 8)
}

export const pinText = (answer: string) => {
  const t = answer.trim()
  return t.length > PIN_MAX ? `${t.slice(0, PIN_MAX)}…` : t
}

// Output of a finished Bash call, as the tool returned it.
export function outputOf(result: unknown) {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const r = result as { stdout?: unknown; stderr?: unknown }
    return `${String(r.stdout ?? '')}\n${String(r.stderr ?? '')}`
  }
  return ''
}

// The band's failing-test name as last written, so a passing run does not rewrite null.
let lastFail: string | null = null
// The long-turn reminder of the running turn; cancelled when it ends.
let longTimer: Timer | null = null

async function copyText($: EngineInterface, text: string) {
  const copied = await $.ui.copy({ text }).catch(() => undefined)
  void notice($, copied?.isCopied ? '✅ Đã sao chép' : '❌ Không sao chép được')
}

async function savePrompt($: EngineInterface, text: string) {
  await setPrompts($, list => [...list.filter(p => p !== text), text].slice(-30))
  void notice($, 'Đã lưu vào Prompt nhanh')
}

async function longTurn($: EngineInterface) {
  const s = await read($, settings)
  void notice($, `⏳ Lượt này đã chạy ${LONG_TURN_MS / 60_000} phút, Claude vẫn đang làm.`)
  const muted = s.quiet && inQuiet(new Date(await $.clock.now()).getHours())
  if (!muted) void $.ui.notify('Lượt vẫn đang chạy', { title: (await read($, project)) || 'Claude' }).catch(() => undefined)
}

// The sessions list and the subagent rows are only drawn in their panes: poll
// while one is in front, not all session long. The band's agent count polls
// while an agent runs.
let polling = false
export async function pollPanes($: EngineInterface) {
  if (polling) return
  polling = true
  try {
    const shown = new Set((await $.ui.panes()).filter(p => p.isShown).map(p => p.id))
    await Promise.all([
      shown.has(PEERS_PANE) ? syncPeers($) : undefined,
      shown.has(DASH) || agentsLive ? refreshAgents($) : undefined,
    ])
  } catch {
    // A missed round; the next tick tries again.
  } finally {
    polling = false
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
      [...SAFE_GIT, '-C', dir, 'diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', 'HEAD', '--', path],
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

const openDash = ($: EngineInterface) => {
  void refreshAgents($)
  return $.ui.open({ id: DASH, title: 'Hoạt động' })
}
const openPeers = ($: EngineInterface) => {
  void syncPeers($)
  return $.ui.open({ id: PEERS_PANE, title: 'Sessions' })
}
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

const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000

// On start: at most one check per UPDATE_CHECK_MS, only for a marketplace install.
// A failed check still counts, so an offline start does not retry on every launch.
export async function autoUpdate($: EngineInterface) {
  if (!(await read($, settings)).autoupdate) return
  if (!$.plugin.root.includes('/.claude/plugins/cache/')) return
  const now = await $.clock.now()
  if (now - (Number(await $.store.get('updateCheckedAt')) || 0) < UPDATE_CHECK_MS) return
  await $.store.set('updateCheckedAt', now)
  const text = await updatePlugin($)
  if (text.startsWith('✗')) void notice($, `terminal-polish: ${text.split('\n')[0]}`)
  else if (text.includes('✓')) void notice($, '🔄 terminal-polish: đã cập nhật, đang nạp lại plugin')
}

// Token weather (after Anthropic's token-weather sample mod): the context's fill as a forecast.
export const weatherOf = (pct: number) => (pct < 25 ? '☀' : pct < 50 ? '☁' : pct < 75 ? '☂' : pct < 90 ? '☇' : '↯')
// What the last turn added to the context: +850, +12k, +1.2M; nothing when it added nothing.
export const kTokens = (n: number | null | undefined) =>
  !n || n <= 0
    ? undefined
    : n < 1000
      ? `+${n}`
      : n < 1_000_000
        ? `+${n < 10_000 ? (n / 1000).toFixed(1) : Math.round(n / 1000)}k`
        : `+${(n / 1_000_000).toFixed(1)}M`

const LIMIT_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$' }
const pad2 = (n: number) => String(n).padStart(2, '0')
const localDay = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// ---- stats (12, 14): kept across sessions in $.store, one row per day and project
type DayStats = { turns: number; seconds: number; tools: number; usd: number }
type Stats = Record<string, Record<string, DayStats>>

async function loadStats($: EngineInterface): Promise<Stats> {
  const raw = await $.store.get('stats')
  return raw && typeof raw === 'object' ? (raw as Stats) : {}
}

// ponytail: read-modify-write on one store key; sessions running at once can
// drop each other's turns (last writer wins). Per-session keys summed on read
// is the upgrade if the numbers need to be exact.
async function recordStats($: EngineInterface, name: string, done: LastTurn, usd: number) {
  const stats = await loadStats($)
  const day = localDay(await $.clock.now())
  const row = stats[day]?.[name] ?? { turns: 0, seconds: 0, tools: 0, usd: 0 }
  stats[day] = {
    ...stats[day],
    [name]: {
      turns: row.turns + 1,
      seconds: row.seconds + done.seconds,
      tools: row.tools + done.tools,
      usd: row.usd + usd,
    },
  }
  const keep = Object.keys(stats).sort().slice(-STATS_DAYS)
  const saved: Stats = Object.fromEntries(keep.map(k => [k, stats[k] ?? {}]))
  await $.store.set('stats', saved)
  return saved
}

async function statsText($: EngineInterface) {
  const stats = await loadStats($)
  const days = Object.keys(stats).sort().slice(-7)
  if (days.length === 0) return 'Chưa có số liệu. Số liệu được ghi sau mỗi lượt.'
  const sum = (rows: DayStats[]) =>
    rows.reduce(
      (a, r) => ({
        turns: a.turns + r.turns,
        seconds: a.seconds + r.seconds,
        tools: a.tools + r.tools,
        usd: a.usd + r.usd,
      }),
      { turns: 0, seconds: 0, tools: 0, usd: 0 },
    )
  const line = (label: string, r: DayStats) =>
    `  ${label.padEnd(22)}${String(r.turns).padStart(5)} lượt ${duration(r.seconds * 1000).padStart(8)} ${String(r.tools).padStart(6)} tool  $${r.usd.toFixed(2)}`
  const today = localDay(await $.clock.now())
  const week = sum(days.flatMap(d => Object.values(stats[d] ?? {})))
  return [
    '7 ngày gần nhất:',
    ...days.map(d => line(d, sum(Object.values(stats[d] ?? {})))),
    line('Tổng 7 ngày', week),
    `Hôm nay theo dự án:`,
    ...Object.entries(stats[today] ?? {}).map(([name, r]) => line(name, r)),
  ].join('\n')
}

// ---- abbreviations (15): `;key` in a prompt expands to its text
async function loadAbbrevs($: EngineInterface): Promise<Record<string, string>> {
  const raw = await $.store.get('abbrevs')
  return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {}
}

function expandAbbrevs(text: string, abbrevs: Record<string, string>) {
  return text.replace(/(^|\s)(;[\p{L}\p{N}_-]+)(?=\s|$)/gu, (whole: string, pre: string, key: string) =>
    typeof abbrevs[key] === 'string' ? pre + abbrevs[key] : whole,
  )
}

async function abbrevCommand($: EngineInterface, rest: string) {
  const abbrevs = await loadAbbrevs($)
  const [key = '', ...words] = rest.split(/\s+/).filter(Boolean)
  if (!key) {
    const rows = Object.entries(abbrevs).map(([k, v]) => `  ${k.padEnd(12)}${v.length > 70 ? `${v.slice(0, 69)}…` : v}`)
    return rows.length
      ? ['Từ viết tắt:', ...rows].join('\n')
      : 'Chưa có từ viết tắt. Thêm: /mods abbrev ;fix <nội dung>'
  }
  const name = key.startsWith(';') ? key : `;${key}`
  if (words.length === 0) {
    delete abbrevs[name]
    await $.store.set('abbrevs', abbrevs)
    return `Đã xóa ${name}`
  }
  abbrevs[name] = words.join(' ')
  await $.store.set('abbrevs', abbrevs)
  return `Đã lưu: ${name} → ${abbrevs[name]}`
}

// ---- project rules (17): per project root, added to the system prompt
async function loadRules($: EngineInterface) {
  const raw = await $.store.get('rules')
  return raw && typeof raw === 'object' ? (raw as Record<string, string[]>) : {}
}

async function setRules($: EngineInterface, change: (list: string[]) => string[]) {
  const all = await loadRules($)
  const key = await read($, root)
  const list = change(Array.isArray(all[key]) ? all[key] : [])
  all[key] = list
  await $.store.set('rules', all)
  await update($, rules, () => list)
  return list
}

const rulesText = (list: string[]) =>
  list.length
    ? ['Luật của dự án này:', ...list.map((r, i) => `  ${i + 1}. ${r}`), 'Xóa: /mods unrule <số>'].join('\n')
    : 'Dự án này chưa có luật. Thêm: /mods rule <nội dung>'

// ---- find (22): search this session's messages
async function findCommand($: EngineInterface, text: string) {
  if (!text) return { text: 'Cách dùng: /mods find <từ khóa>' }
  const needle = text.toLowerCase()
  const hits: Found[] = []
  for (const m of await $.session.messages()) {
    const at = m.text.toLowerCase().indexOf(needle)
    if (at < 0) continue
    const from = Math.max(0, at - 60)
    const snippet = `${from > 0 ? '…' : ''}${m.text.slice(from, at + needle.length + 80).replace(/\s+/g, ' ')}…`
    hits.push({ role: m.role, snippet })
  }
  await update($, query, () => text)
  await update($, found, () => hits.slice(-40))
  await $.ui.open({ id: FIND_PANE, title: `Tìm "${text}"` })
  return { text: `${hits.length} kết quả cho "${text}".` }
}

// ---- timer (23): a countdown on the band, a notification at the end
let timerHandles: Timer[] = []

function stopTimer() {
  for (const t of timerHandles) t.cancel()
  timerHandles = []
}

async function armTimer($: EngineInterface, endsAt: number) {
  stopTimer()
  const tick = async () => {
    const left = Math.max(0, Math.ceil((endsAt - (await $.clock.now())) / 60000))
    const value: TimerState = { endsAt, left }
    if (!same(await read($, timer), value)) await update($, timer, () => value)
  }
  await tick()
  const now = await $.clock.now()
  timerHandles = [
    $.clock.every(15000, () => void tick()),
    $.clock.after(Math.max(0, endsAt - now), () => {
      stopTimer()
      void update($, timer, () => null)
      void notice($, '⏰ Hết giờ!')
      void $.ui.notify('Hết giờ!', { title: 'terminal-polish' }).catch(() => undefined)
      void read($, settings).then(s => {
        if (s.sound) void $.audio.play({ asset: 'sounds/done.wav' }).catch(() => undefined)
      })
    }),
  ]
}

async function timerCommand($: EngineInterface, rest: string) {
  const minutes = Number.parseFloat(rest)
  if (!rest || !(minutes > 0)) {
    const t = await read($, timer)
    stopTimer()
    await update($, timer, () => null)
    return t ? 'Đã hủy hẹn giờ.' : 'Cách dùng: /mods timer <phút>   (không số: hủy)'
  }
  const clamped = Math.min(minutes, 24 * 60)
  const endsAt = (await $.clock.now()) + clamped * 60000
  await armTimer($, endsAt)
  return `⏱ Hẹn giờ ${clamped} phút.`
}

// ---- pasted images: a thumbnail under the prompt's [Image #n], a press opens the file
export type Pic = { label: string; mediaType: string; data: string }
type ApiMsg = { role: string; content: { type: string; [field: string]: unknown }[] }
const IMAGE_TOKEN = /\[Image #\d+\]/g
const IMAGE_MAX_BASE64 = (2 * 1024 * 1024 * 4) / 3 // Image takes 2 MiB decoded
const picCache = new Map<string, Pic[]>()
const PIC_CACHE_ROWS = 20
const picMiss = new Map<string, number>() // rowId -> earliest retry
const PIC_RETRY_MS = 3000
const unTokened = (text: string) => text.replace(IMAGE_TOKEN, '').replace(/\s+/g, ' ').trim()

async function picsFor($: EngineInterface, rowId: string, text: string): Promise<Pic[]> {
  const cached = picCache.get(rowId)
  if (cached) return cached
  if (!text.includes('[Image #')) return []
  // A miss is retried, since the row may draw before its message is stored, but at most
  // every few seconds: each try pulls the whole transcript with every image's base64.
  const now = Date.now()
  if ((picMiss.get(rowId) ?? 0) > now) return []
  const pics = matchPics(await $.session.messages({ as: 'api' }).catch(() => []), text)
  if (pics.length) {
    picMiss.delete(rowId)
    picCache.set(rowId, pics)
    // Each entry holds the images' base64 (up to MBs): keep the newest rows only.
    if (picCache.size > PIC_CACHE_ROWS) picCache.delete(picCache.keys().next().value ?? '')
  } else {
    picMiss.set(rowId, now + PIC_RETRY_MS)
    if (picMiss.size > PIC_CACHE_ROWS) picMiss.delete(picMiss.keys().next().value ?? '')
  }
  return pics
}

// The row carries no bytes; the stored user message with the same words does.
// ponytail: newest text match wins, so two identical prompts show the newer's images.
export function matchPics(messages: readonly ApiMsg[], text: string): Pic[] {
  const labels = text.match(IMAGE_TOKEN) ?? []
  if (!labels.length) return []
  const want = unTokened(text)
  for (const m of [...messages].reverse()) {
    if (m.role !== 'user') continue
    const sources = m.content.flatMap(b => {
      const s = b.type === 'image' ? (b.source as { type?: string; media_type?: string; data?: string }) : undefined
      return s?.type === 'base64' && s.data ? [{ mediaType: String(s.media_type), data: s.data }] : []
    })
    if (!sources.length) continue
    const said = m.content.flatMap(b => (b.type === 'text' ? [unTokened(String(b.text))] : []))
    if (want && !said.includes(want)) continue
    return sources.map((s, i) => ({ ...s, label: labels[i] ?? `[Image #${i + 1}]` }))
  }
  return []
}

// PNG's IHDR holds width and height, big-endian, at bytes 16 and 20; a cell is ~2:1.
function thumbSize(data: string) {
  const head = atob(data.slice(0, 32))
  const u32 = (at: number) => [0, 1, 2, 3].reduce((n, i) => n * 256 + head.charCodeAt(at + i), 0)
  const w = u32(16)
  const h = u32(20)
  if (!w || !h) return { columns: 20, rows: 6 }
  const rows = Math.max(1, Math.min(8, Math.round((20 * h) / w / 2)))
  return { columns: Math.max(1, Math.min(20, Math.round((rows * 2 * w) / h))), rows }
}

const OPEN = '{ command -v xdg-open >/dev/null && opener=xdg-open || opener=open; } && ("$opener" "$f" >/dev/null 2>&1 &)'

// A URL opens in the browser, a file in the app the desktop picks for it.
export async function openTarget($: EngineInterface, target: string) {
  const script = /^https?:/.test(target)
    ? `f="$1" && ${OPEN}`
    : `f="$1"; case "$f" in "~/"*) f="$HOME/\${f#\~/}";; -*) f="./$f";; esac; [ -e "$f" ] || { echo "không tồn tại: $1" >&2; exit 1; }; ${OPEN}`
  // Relative paths in a reply are relative to the project, not to wherever the engine runs.
  const cwd = (await read($, root)) || undefined
  const run = await $.process.run(['sh', '-c', script, 'sh', target], { cwd, timeoutMs: 10000 })
  if (run.exitCode !== 0) void notice($, `Không mở được: ${run.stderr.trim() || run.exitCode}`)
}

export async function openPic($: EngineInterface, pic: Pic) {
  const ext = pic.mediaType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'png'
  const run = await $.process.run(
    [
      'sh',
      '-c',
      'f=$(mktemp "${TMPDIR:-/tmp}/claude-image-XXXXXX.$1") && base64 -d > "$f" && ' + OPEN,
      'sh',
      ext,
    ],
    { stdin: pic.data, timeoutMs: 10000 },
  )
  if (run.exitCode !== 0) void notice($, `Không mở được ảnh: ${run.stderr.trim() || run.exitCode}`)
}

// ---- selection (16): act on what the person selected in the fullscreen transcript
async function grabSelection($: EngineInterface) {
  const picked = await $.ui.selection()
  if (!picked?.text.trim()) {
    void notice($, 'Chưa bôi đen gì (chỉ có ở chế độ fullscreen)')
    return false
  }
  await update($, selection, () => picked.text)
  await $.ui.open({ id: SELECTION_PANE, title: 'Đoạn đã chọn' })
  return true
}

// ---- journal (21): one entry per session, appended at its end
async function writeJournal($: EngineInterface) {
  const dir = await read($, home)
  if (!dir) return
  const path = `${dir}/.claude/mods-journal.md`
  const t = await read($, totals)
  const use = await read($, usage)
  const touched = await read($, files)
  const now = await $.clock.now()
  const began = await read($, startedAt)
  const d = new Date(now)
  const entry = [
    `## ${localDay(now)} ${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${(await read($, project)) || 'claude'}`,
    `- ${t.turns} lượt · ${duration(Math.max(0, now - began))} · ${t.tools} tool${use?.usd != null ? ` · $${use.usd.toFixed(2)}` : ''}`,
    `- File đã sửa: ${touched.length ? touched.map(baseName).join(', ') : 'không có'}`,
    '',
  ].join('\n')
  let before = '# Nhật ký Claude Code (terminal-polish)\n\n'
  try {
    before = await $.fs.read(path)
  } catch (error) {
    // Only a missing file starts a new journal; any other failure must not overwrite it.
    if (await $.fs.exists(path)) throw error
  }
  await $.fs.write(path, `${before}${before.endsWith('\n') ? '' : '\n'}${entry}`)
}

// ---- tool badges (25): only tools whose own row is a single line; Edit,
// Write, TodoWrite and the like draw a diff or a list the badge would hide.
type BadgeRole = 'warn' | 'info' | 'violet' | 'accent' | 'cyan' | 'pink'
const BADGE: Record<string, BadgeRole> = {
  Bash: 'warn',
  Read: 'info',
  Grep: 'violet',
  Glob: 'violet',
  Agent: 'accent',
  WebFetch: 'cyan',
  WebSearch: 'cyan',
}

function summaryOf(input: unknown) {
  const i = (input ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : undefined)
  const path = str('file_path') ?? str('notebook_path')
  return (
    (str('command') !== undefined ? commandLabel(str('command') ?? '') : undefined) ??
    (path ? baseName(path) : undefined) ??
    str('pattern') ??
    str('url') ??
    str('query') ??
    str('description') ??
    str('prompt')?.slice(0, 80) ??
    ''
  )
}

const openSettings = ($: EngineInterface) => $.ui.open({ id: SETTINGS_PANE, title: 'Cài đặt' })

const REVIEWER_PROMPT = `You review code changes. Read the diff or files you are pointed at, then report only real problems: correctness bugs, security issues, missed edge cases, and needless complexity. For each finding give file:line, what goes wrong, and the smallest fix. Do not edit files. If nothing is wrong, say so plainly. Answer in the language the request was written in.`
const TESTER_PROMPT = `You test a change. Find how the project runs its tests, write the smallest tests that would fail if the change were wrong, run them, and report the exact commands and their output. Do not change non-test code. If something fails, show the failure and your best reading of its cause. Answer in the language the request was written in.`

// ================================================================ look and feel
// A palette names roles, not hues. `auto` keeps the person's Claude Code theme
// (theme keys) and adds hex only where a gradient needs real colors; the named
// themes are their published dark palettes.
type Palette = {
  accent: string
  ok: string
  warn: string
  err: string
  info: string
  muted: string
  violet: string
  cyan: string
  pink: string
  ink: string
  grad: readonly string[]
  meter: readonly [string, string, string]
  // The terminal background the theme was drawn for; the mod cannot set it, it only suggests it.
  bg?: string
  // An animated SVG strip the desktop draws in the band (sceneSvg).
  scene?: 'taiji' | 'qi' | 'mist' | 'stars'
}

const AUTO: Palette = {
  accent: 'claude',
  ok: 'success',
  warn: 'warning',
  err: 'error',
  info: 'suggestion',
  muted: 'subtle',
  violet: 'permission',
  cyan: 'ide',
  pink: 'merged',
  ink: 'inverseText',
  grad: ['#d97757', '#e0779d', '#b07ae0', '#6c8ee8'],
  meter: ['#3fb950', '#d29922', '#f85149'],
}

const THEMES: Record<string, Palette> = {
  auto: AUTO,
  catppuccin: {
    accent: '#cba6f7',
    ok: '#a6e3a1',
    warn: '#f9e2af',
    err: '#f38ba8',
    info: '#89b4fa',
    muted: '#7f849c',
    violet: '#b4befe',
    cyan: '#94e2d5',
    pink: '#f5c2e7',
    ink: '#1e1e2e',
    grad: ['#f5c2e7', '#cba6f7', '#89b4fa', '#94e2d5'],
    meter: ['#a6e3a1', '#f9e2af', '#f38ba8'],
    bg: '#1e1e2e',
  },
  tokyonight: {
    accent: '#7aa2f7',
    ok: '#9ece6a',
    warn: '#e0af68',
    err: '#f7768e',
    info: '#7dcfff',
    muted: '#565f89',
    violet: '#bb9af7',
    cyan: '#2ac3de',
    pink: '#ff007c',
    ink: '#1a1b26',
    grad: ['#bb9af7', '#7aa2f7', '#7dcfff', '#9ece6a'],
    meter: ['#9ece6a', '#e0af68', '#f7768e'],
    bg: '#1a1b26',
  },
  dracula: {
    accent: '#bd93f9',
    ok: '#50fa7b',
    warn: '#f1fa8c',
    err: '#ff5555',
    info: '#8be9fd',
    muted: '#6272a4',
    violet: '#bd93f9',
    cyan: '#8be9fd',
    pink: '#ff79c6',
    ink: '#282a36',
    grad: ['#ff79c6', '#bd93f9', '#8be9fd', '#50fa7b'],
    meter: ['#50fa7b', '#f1fa8c', '#ff5555'],
    bg: '#282a36',
  },
  nord: {
    accent: '#88c0d0',
    ok: '#a3be8c',
    warn: '#ebcb8b',
    err: '#bf616a',
    info: '#81a1c1',
    muted: '#616e88',
    violet: '#b48ead',
    cyan: '#8fbcbb',
    pink: '#b48ead',
    ink: '#2e3440',
    grad: ['#8fbcbb', '#88c0d0', '#81a1c1', '#b48ead'],
    meter: ['#a3be8c', '#ebcb8b', '#bf616a'],
    bg: '#2e3440',
  },
  gruvbox: {
    accent: '#fe8019',
    ok: '#b8bb26',
    warn: '#fabd2f',
    err: '#fb4934',
    info: '#83a598',
    muted: '#928374',
    violet: '#d3869b',
    cyan: '#8ec07c',
    pink: '#d3869b',
    ink: '#282828',
    grad: ['#fb4934', '#fe8019', '#fabd2f', '#b8bb26'],
    meter: ['#b8bb26', '#fabd2f', '#fb4934'],
    bg: '#282828',
  },
  // ---- navy blue dark family
  navy: {
    accent: '#5b8def',
    ok: '#4ade80',
    warn: '#fbbf24',
    err: '#f87171',
    info: '#60a5fa',
    muted: '#64748b',
    violet: '#818cf8',
    cyan: '#22d3ee',
    pink: '#f472b6',
    ink: '#0b1426',
    grad: ['#4f86ee', '#5b8def', '#7fb0ff', '#a5d8ff'],
    meter: ['#4ade80', '#fbbf24', '#f87171'],
    bg: '#0b1426',
  },
  midnight: {
    accent: '#e2b714',
    ok: '#7ec699',
    warn: '#f0a35e',
    err: '#ef6b73',
    info: '#7aa2f7',
    muted: '#5c6a8a',
    violet: '#9d8cff',
    cyan: '#5ccfe6',
    pink: '#f29fbf',
    ink: '#0d1b2a',
    grad: ['#e2b714', '#f0c75e', '#9fb8ff', '#6b8cff'],
    meter: ['#7ec699', '#f0a35e', '#ef6b73'],
    bg: '#0d1b2a',
  },
  abyss: {
    accent: '#2dd4bf',
    ok: '#34d399',
    warn: '#fcd34d',
    err: '#fb7185',
    info: '#38bdf8',
    muted: '#4b6584',
    violet: '#a78bfa',
    cyan: '#67e8f9',
    pink: '#f9a8d4',
    ink: '#06142b',
    grad: ['#0ea5e9', '#14b8a6', '#2dd4bf', '#99f6e4'],
    meter: ['#34d399', '#fcd34d', '#fb7185'],
    bg: '#06142b',
  },
  nightowl: {
    accent: '#82aaff',
    ok: '#addb67',
    warn: '#ecc48d',
    err: '#ef5350',
    info: '#7fdbca',
    muted: '#637777',
    violet: '#c792ea',
    cyan: '#21c7a8',
    pink: '#ff5874',
    ink: '#011627',
    grad: ['#c792ea', '#82aaff', '#7fdbca', '#addb67'],
    meter: ['#addb67', '#ecc48d', '#ef5350'],
    bg: '#011627',
  },
  cobalt: {
    accent: '#ffc600',
    ok: '#3ad900',
    warn: '#ff9d00',
    err: '#ff7aa0',
    info: '#3ca0ff',
    muted: '#6b88a6',
    violet: '#fb94ff',
    cyan: '#9effff',
    pink: '#ff7aa0',
    ink: '#193549',
    grad: ['#ffc600', '#ff9d00', '#3ca0ff', '#9effff'],
    meter: ['#3ad900', '#ffc600', '#ff7aa0'],
    bg: '#193549',
  },
  rosepine: {
    accent: '#c4a7e7',
    ok: '#9ccfd8',
    warn: '#f6c177',
    err: '#eb6f92',
    info: '#31748f',
    muted: '#6e6a86',
    violet: '#c4a7e7',
    cyan: '#9ccfd8',
    pink: '#ebbcba',
    ink: '#191724',
    grad: ['#eb6f92', '#ebbcba', '#c4a7e7', '#9ccfd8'],
    meter: ['#9ccfd8', '#f6c177', '#eb6f92'],
    bg: '#191724',
  },
  kanagawa: {
    accent: '#7e9cd8',
    ok: '#98bb6c',
    warn: '#e6c384',
    err: '#e82424',
    info: '#7fb4ca',
    muted: '#727169',
    violet: '#957fb8',
    cyan: '#6a9589',
    pink: '#d27e99',
    ink: '#1f1f28',
    grad: ['#957fb8', '#7e9cd8', '#7fb4ca', '#e6c384'],
    meter: ['#98bb6c', '#e6c384', '#e82424'],
    bg: '#1f1f28',
  },
  // ---- Đạo giáo / tu tiên family: animated scenes on the desktop
  thaicuc: {
    accent: '#e8e4d8',
    ok: '#7fb685',
    warn: '#d9a441',
    err: '#c8423b',
    info: '#8fb3b0',
    muted: '#6b6760',
    violet: '#a89cc8',
    cyan: '#8fb3b0',
    pink: '#d98c80',
    ink: '#141414',
    grad: ['#f2efe6', '#bdb8aa', '#7fb685', '#c8423b'],
    meter: ['#7fb685', '#d9a441', '#c8423b'],
    bg: '#141414',
    scene: 'taiji',
  },
  tutien: {
    accent: '#f0c75e',
    ok: '#6fd3a0',
    warn: '#f0a35e',
    err: '#e5534b',
    info: '#9d8cff',
    muted: '#6c6290',
    violet: '#b48cff',
    cyan: '#7ae0e0',
    pink: '#f29fd0',
    ink: '#140c24',
    grad: ['#7a4cff', '#b48cff', '#f0c75e', '#fff1b8'],
    meter: ['#6fd3a0', '#f0c75e', '#e5534b'],
    bg: '#140c24',
    scene: 'qi',
  },
  linhson: {
    accent: '#7cc4a4',
    ok: '#8fce8f',
    warn: '#e3c27a',
    err: '#d9665b',
    info: '#8ab8d6',
    muted: '#5f7a72',
    violet: '#a3a6d6',
    cyan: '#88d0c8',
    pink: '#e3a5b5',
    ink: '#0f1d1a',
    grad: ['#2f5d50', '#4f9478', '#7cc4a4', '#d6eadf'],
    meter: ['#8fce8f', '#e3c27a', '#d9665b'],
    bg: '#0f1d1a',
    scene: 'mist',
  },
  tinhha: {
    accent: '#8fb8ff',
    ok: '#7ee0a8',
    warn: '#ffd27a',
    err: '#ff7a8a',
    info: '#8fb8ff',
    muted: '#5a6488',
    violet: '#c3a6ff',
    cyan: '#7fe7ff',
    pink: '#ffa6d9',
    ink: '#070a1a',
    grad: ['#3a4cc8', '#8fb8ff', '#c3a6ff', '#ffe9b8'],
    meter: ['#7ee0a8', '#ffd27a', '#ff7a8a'],
    bg: '#070a1a',
    scene: 'stars',
  },
}

// A wide strip of SMIL animation for themes with a scene. Deterministic per palette: a new
// `source` would reload the sandboxed frame and restart the animation on every band render.
const SCENE_H = 36
const sceneCache = new Map<string, string>()
function sceneSvg(P: Palette): string | null {
  if (!P.scene) return null
  const cacheKey = `${P.scene}|${P.bg}|${P.grad.join()}`
  const hit = sceneCache.get(cacheKey)
  if (hit) return hit
  const bg = P.bg ?? '#000'
  const [a = '#fff', b = a, c = b, d = c] = P.grad
  // A fixed pseudo-random spread, the same on every call.
  const spots = (n: number, k: number) =>
    Array.from({ length: n }, (_, i) => ({ x: (i * 97 + k * 31) % 800, y: (i * 53 + k * 17) % SCENE_H, i }))
  const body = (() => {
    switch (P.scene) {
      case 'taiji': {
        // Yin-yang turning at the center, trigram bars drifting, ink mist behind.
        const R = 14
        const fish = `<g transform="translate(400 18)"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="12s" repeatCount="indefinite"/><circle r="${R}" fill="${a}"/><path d="M0 -${R} A${R} ${R} 0 0 0 0 ${R} A${R / 2} ${R / 2} 0 0 0 0 0 A${R / 2} ${R / 2} 0 0 1 0 -${R}Z" fill="${bg}"/><circle cy="-${R / 2}" r="2.5" fill="${bg}"/><circle cy="${R / 2}" r="2.5" fill="${a}"/></g></g>`
        const trigrams = spots(8, 1)
          .map(
            ({ x, i }) =>
              `<g opacity="0.35" transform="translate(${(x + 60) % 760} 10)">${[0, 6, 12]
                .map(y => ((i >> (y / 6)) & 1 ? `<rect y="${y}" width="16" height="3" fill="${c}"/>` : `<rect y="${y}" width="7" height="3" fill="${c}"/><rect x="9" y="${y}" width="7" height="3" fill="${c}"/>`))
                .join('')}<animate attributeName="opacity" values="0.1;0.45;0.1" dur="${4 + (i % 4)}s" repeatCount="indefinite"/></g>`,
          )
          .join('')
        return `<rect width="800" height="${SCENE_H}" fill="${bg}"/><ellipse cx="400" cy="30" rx="420" ry="10" fill="${b}" opacity="0.12"><animate attributeName="cx" values="360;440;360" dur="18s" repeatCount="indefinite"/></ellipse>${trigrams}${fish}`
      }
      case 'qi':
        // Golden qi motes rising through a violet haze.
        return `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.5" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs><rect width="800" height="${SCENE_H}" fill="${bg}"/><rect width="800" height="${SCENE_H}" fill="url(#g)" opacity="0.25"><animate attributeName="opacity" values="0.15;0.35;0.15" dur="6s" repeatCount="indefinite"/></rect>${spots(28, 2)
          .map(
            ({ x, i }) =>
              `<circle cx="${x}" r="${1 + (i % 3)}" fill="${i % 3 ? c : d}"><animate attributeName="cy" values="${SCENE_H + 4};-4" dur="${3 + (i % 5)}s" begin="-${i % 7}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="${3 + (i % 5)}s" begin="-${i % 7}s" repeatCount="indefinite"/></circle>`,
          )
          .join('')}`
      case 'mist':
        // Ink-wash peaks with cloud bands drifting across.
        return `<rect width="800" height="${SCENE_H}" fill="${bg}"/><path d="M0 36 L60 14 L110 28 L180 6 L260 30 L330 12 L420 32 L500 8 L580 26 L660 10 L740 28 L800 16 L800 36Z" fill="${a}" opacity="0.8"/><path d="M0 36 L90 22 L170 32 L250 18 L350 34 L460 20 L560 34 L690 18 L800 30 L800 36Z" fill="${b}" opacity="0.7"/>${[0, 1, 2]
          .map(
            i =>
              `<ellipse cy="${12 + i * 8}" rx="${120 + i * 40}" ry="4" fill="${d}" opacity="${0.25 - i * 0.05}"><animate attributeName="cx" values="-200;1000" dur="${20 + i * 9}s" begin="-${i * 7}s" repeatCount="indefinite"/></ellipse>`,
          )
          .join('')}`
      case 'stars':
        // A starry river: twinkling stars and a slow shooting star.
        return `<rect width="800" height="${SCENE_H}" fill="${bg}"/><ellipse cx="400" cy="18" rx="380" ry="8" fill="${a}" opacity="0.18"/>${spots(40, 3)
          .map(
            ({ x, y, i }) =>
              `<circle cx="${x}" cy="${y}" r="${i % 5 ? 0.8 : 1.5}" fill="${i % 4 ? b : d}"><animate attributeName="opacity" values="0.2;1;0.2" dur="${2 + (i % 4)}s" begin="-${i % 3}s" repeatCount="indefinite"/></circle>`,
          )
          .join('')}<line x1="0" y1="0" x2="30" y2="10" stroke="${d}" stroke-width="1.2" stroke-linecap="round"><animateTransform attributeName="transform" type="translate" values="-60 -10;860 30" dur="7s" repeatCount="indefinite"/></line>`
    }
  })()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${SCENE_H}" viewBox="0 0 800 ${SCENE_H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`
  sceneCache.set(cacheKey, svg)
  return svg
}

async function palette($: EngineInterface): Promise<Palette> {
  return THEMES[await read($, theme)] ?? AUTO
}

async function setTheme($: EngineInterface, name: string) {
  await update($, theme, () => name)
  await $.store.set('theme', name)
}

const rgbOf = (hex: string) => {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}
const hexOf = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map(v =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

// The color at t (0..1) along evenly spaced hex stops.
function colorAt(stops: readonly string[], t: number) {
  if (stops.length === 1) return stops[0] ?? '#ffffff'
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(Math.floor(x), stops.length - 2)
  const [a, b] = [rgbOf(stops[i] ?? '#ffffff'), rgbOf(stops[i + 1] ?? '#ffffff')]
  const f = x - i
  return hexOf(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f)
}

// One colored run per character.
const gradientRuns = (text: string, stops: readonly string[]) =>
  [...text].map((ch, i, all) => ({ ch, color: colorAt(stops, all.length < 2 ? 0 : i / (all.length - 1)) }))

// ▰▰▰▱▱: lit cells colored by where they sit on green → amber → red.
function meterCells(pct: number, width: number, P: Palette) {
  const lit = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width)
  return Array.from({ length: width }, (_, i) =>
    i < lit ? { ch: '▰', color: colorAt(P.meter, width < 2 ? 0 : i / (width - 1)) } : { ch: '▱', color: P.muted },
  )
}

// ---- Raster frames (32, 33): three uint32 per cell, glyph, fg, bg, as base64.
const DEFAULT_COLOR = 0x01000000
const DIM_LINE = 0x5c5c5c
const hexNum = (hex: string) => Number.parseInt(hex.replace('#', ''), 16)

function packCells(cells: readonly (readonly [number, number, number])[]) {
  const words = new Uint32Array(cells.length * 3)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (!cell) continue
    words[i * 3] = cell[0]
    words[i * 3 + 1] = cell[1]
    words[i * 3 + 2] = cell[2]
  }
  return btoa(String.fromCharCode(...new Uint8Array(words.buffer)))
}

const COMET_TAIL = 10
const SPARKS = [...'✦✧•·*+˚']

function fxFrame(mode: 'comet' | 'party', tick: number, width: number, P: Palette) {
  if (mode === 'comet') {
    const head = tick % (width + COMET_TAIL)
    return packCells(
      Array.from({ length: width }, (_, i) => {
        const d = head - i
        if (d < 0 || d >= COMET_TAIL) return [0x2500, DIM_LINE, DEFAULT_COLOR] as const
        return [d < 2 ? 0x2501 : 0x2500, hexNum(colorAt(P.grad, d / COMET_TAIL)), DEFAULT_COLOR] as const
      }),
    )
  }
  // Party: sparks that differ every frame, seeded by the tick so a frame is stable.
  let seed = ((tick + 1) * 2654435761) >>> 0
  const rand = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296
  return packCells(
    Array.from({ length: width }, () =>
      rand() < 0.35
        ? ([
            SPARKS[Math.floor(rand() * SPARKS.length)]?.codePointAt(0) ?? 0x2a,
            hexNum(colorAt(P.grad, rand())),
            DEFAULT_COLOR,
          ] as const)
        : ([0x20, DEFAULT_COLOR, DEFAULT_COLOR] as const),
    ),
  )
}

// The band's site and width as last drawn, so a timer can repaint the Raster.
let bandSite: string | null = null
let fxWidth = 0
let fxTick = 0
let fxTimer: Timer | null = null
let partyTimer: Timer | null = null
const FX_MS = 80
const PARTY_MS = 2600

function stopFx() {
  fxTimer?.cancel()
  fxTimer = null
  partyTimer?.cancel()
  partyTimer = null
}

async function startFx($: EngineInterface, mode: 'comet' | 'party') {
  const [s, P] = await Promise.all([read($, settings), palette($)])
  if (!s.band || (mode === 'comet' && !s.anim) || (mode === 'party' && !s.confetti)) return
  // A turn that ended during the reads above already ran endFx: no comet without a turn.
  if (mode === 'comet' && !(await read($, turn))) return
  // fx is set before the timer exists, so an endFx landing in the gap sees the mode
  // and stops it. Stop and start have no await between, so two overlapping calls
  // cannot both leave a timer running.
  await update($, fx, () => mode)
  stopFx()
  fxTick = 0
  fxTimer = $.clock.every(FX_MS, () => {
    fxTick += 1
    if (!bandSite || fxWidth < 1) return
    void $.ui.blit({ requestId: bandSite, key: 'fx', cells: fxFrame(mode, fxTick, fxWidth, P) }).catch(() => undefined)
  })
  if (mode === 'party') {
    partyTimer = $.clock.after(PARTY_MS, () => void endFx($, 'party'))
  }
}

async function endFx($: EngineInterface, mode: 'comet' | 'party') {
  if ((await read($, fx)) !== mode) return
  stopFx()
  await update($, fx, () => null)
  // A party that ends while a turn still runs hands the band back to the comet.
  if (mode === 'party' && (await read($, turn))) await startFx($, 'comet')
}

const TEST_COMMAND =
  /\b(npm (run )?test|pnpm (run )?test|yarn test|bun test|npx (jest|vitest)|jest|vitest|pytest|go test|cargo test|mix test|rspec|claude plugin test)\b/

// ---- file tags (31)
const FILE_TAGS: Record<string, readonly [string, string]> = {
  ts: ['TS', '#3178c6'],
  tsx: ['TSX', '#3178c6'],
  js: ['JS', '#f1e05a'],
  jsx: ['JSX', '#f1e05a'],
  mjs: ['JS', '#f1e05a'],
  py: ['PY', '#3572a5'],
  md: ['MD', '#83a598'],
  json: ['{}', '#cbcb41'],
  go: ['GO', '#00add8'],
  rs: ['RS', '#dea584'],
  sh: ['SH', '#89e051'],
  zsh: ['SH', '#89e051'],
  css: ['CSS', '#a86bd1'],
  scss: ['CSS', '#c6538c'],
  html: ['HTML', '#e34c26'],
  yml: ['YML', '#cb171e'],
  yaml: ['YML', '#cb171e'],
  sql: ['SQL', '#e38c00'],
  java: ['JAVA', '#b07219'],
  kt: ['KT', '#a97bff'],
  rb: ['RB', '#cc342d'],
  php: ['PHP', '#777bb4'],
}
const fileTag = (path: string) => FILE_TAGS[path.split('.').pop()?.toLowerCase() ?? ''] ?? (['··', '#8b949e'] as const)

// ---- heatmap (35): turns per day, 8 weeks, a row per weekday
const HEAT_WEEKS = 8
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

// Both take the stats a caller already holds, so one turn reads the store once.
async function refreshHeat($: EngineInterface, loaded?: Stats) {
  const stats = loaded ?? (await loadStats($))
  const value = Object.fromEntries(
    Object.entries(stats).map(([day, rows]) => [day, Object.values(rows).reduce((n, r) => n + r.turns, 0)]),
  )
  if (!same(await read($, heat), value)) await update($, heat, () => value)
}

// Columns are weeks ending this week, rows Sunday..Saturday; null past today.
function heatGrid(counts: Record<string, number>, now: number) {
  const today = new Date(now)
  const firstSunday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - today.getDay() - (HEAT_WEEKS - 1) * 7,
  )
  const max = Math.max(1, ...Object.values(counts))
  return Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: HEAT_WEEKS }, (_, week) => {
      const d = new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() + week * 7 + weekday)
      if (d.getTime() > now) return null
      const n = counts[localDay(d.getTime())] ?? 0
      return n === 0 ? 0 : 1 + Math.min(3, Math.floor((n / max) * 3.999))
    }),
  )
}

// ---- fun: a joke beside the spinner each turn, and a mock forecast for the day
export const JOKES = [
  'Code chạy được đừng hỏi tại sao',
  'Không có bug, chỉ có tính năng chưa được tài liệu hoá',
  'Đã thử tắt đi bật lại chưa?',
  'git commit -m "sửa nốt lần cuối" (lần thứ 7)',
  'Trên máy tôi vẫn chạy mà',
  '99 bug trong code, sửa một cái… 127 bug trong code',
  'Comment bảo "tạm thời" từ năm 2019',
  'Deploy chiều thứ Sáu: sống là phải liều',
  'Đặt tên biến khó hơn viết thuật toán',
  'Regex: giờ bạn có hai vấn đề',
  'Cà phê vào, code ra ☕',
  'Stack Overflow đang suy nghĩ cùng bạn',
  'Test xanh thì yên tâm, test đỏ thì yên lặng',
  'Đừng lo, Claude cũng đang đọc lại code cũ của bạn',
  'TODO: viết TODO cho TODO này',
  'Chạy lần hai thì được, đừng hỏi',
  'Đây không phải lỗi, đây là hành vi không mong muốn',
  'Một dấu chấm phẩy đã thay đổi cuộc đời tôi',
  'Bàn phím cơ không làm code nhanh hơn, nhưng nghe kêu hơn',
  'Đang tìm cái semicolon bị lạc',
  'node_modules nặng hơn cả hố đen',
  'Ai viết đoạn này vậy? …à, mình',
  'Merge conflict là cách git nói "hai người cần nói chuyện"',
  'Code đẹp nhất là code không cần viết',
  'Debug bằng console.log: cổ điển nhưng chưa bao giờ lỗi mốt',
  'Production là môi trường test lớn nhất',
  'Mỗi lần refactor là một lần tái sinh',
  'Ước gì đời cũng có Ctrl+Z',
  'Uống nước đi, code chờ được',
  'Claude không mệt, nhưng bạn nên nghỉ mắt 20 giây',
  'Tab hay space? Đừng hỏi, hỏi là có chiến tranh tôn giáo',
  'Khách bảo "đơn giản thôi": đơn giản kiểu ba tháng',
  'Dev nói "chỉ sửa một dòng", và 47 file đã đổi',
  'Đừng gọi là bug, gọi là easter egg',
  'Lỗi 404 không phải trang không tồn tại, mà là trang đi chơi',
  'Bug không biến mất, nó ngủ đông sang bản release sau',
  'Build 20 phút, đủ uống thêm một ly cà phê và đặt lại tên biến',
  'Xoá được một dòng code cũ là cảm giác sảng khoái nhất nghề',
  'Đổi tên biến cho đẹp, rồi đổi lại vì tên cũ dễ hiểu hơn',
  'Sprint planning: hứa nhiều, làm vừa, retro thì kể chuyện',
  'Tôi không lười, tôi đang tối ưu thời gian chờ build',
  'Code review ghi "ổn": nghĩa là chưa đọc kỹ',
  'Code legacy do chính bạn 6 tháng trước viết, và hắn ghét bạn',
  'Sếp hỏi "xong chưa?" là câu không có đáp án đúng',
  'Ước tính 2 ngày, thực tế 2 quý, production là môi trường test cuối',
  'Commit "fix" lúc 3 giờ sáng, sáng mai đọc lại và cầu nguyện',
  'Ngày nào không có warning là ngày đáng ngờ',
  'Test không bỏ qua bạn, chỉ là bạn bỏ qua test',
  'Không biết vì sao nó chạy? Đừng đụng vào, cảm ơn',
  'Xoá node_modules, cài lại, cầu nguyện, lặp lại',
  'Feature freeze là lúc mọi feature bắt đầu nảy mầm',
  'Refactor xong: code mới, bug mới, ra mắt cùng lúc',
  'Estimate là con số để sếp có cái mà tin',
  'Tài liệu hướng dẫn là thứ ai cũng nói sẽ viết sau',
  'Chạy được trên máy tôi là lời tuyên bố chính thức của mọi dev',
]

const FORECAST_SKY = [
  '☀ Trời quang, ít bug',
  '🌤 Nắng nhẹ, thỉnh thoảng có warning',
  '⛅ Nhiều mây merge conflict',
  '🌧 Mưa test đỏ rải rác buổi chiều',
  '⛈ Giông deadline cuối ngày',
  '🌈 Sau cơn build lỗi trời lại xanh',
  '🌫 Sương mù yêu cầu chưa rõ',
  '🌪 Lốc refactor bất ngờ',
]
const FORECAST_LUCK = [
  'Hôm nay hợp sửa bug cũ, kỵ deploy thứ Sáu.',
  'Quý nhân phù trợ: người review PR nhanh.',
  'Số may mắn: 200 OK. Màu may mắn: xanh như test pass.',
  'Nên commit nhỏ, tránh push --force.',
  'Có duyên gặp lại cái bug tưởng đã sửa tuần trước.',
  'Tài lộc: tiết kiệm được 3 lần chạy lại CI.',
  'Đào hoa: được đồng nghiệp khen "code sạch đấy".',
  'Cẩn thận lời nói trong commit message, sếp đọc đấy.',
  'Hợp viết test, sẽ phát hiện điều bất ngờ.',
  'Tránh xa node_modules sau 5 giờ chiều.',
  'Một câu "chắc chạy được" sẽ quay lại ám bạn.',
  'Rất hợp để xoá code thừa: nhẹ người, nhẹ repo.',
]

// The same forecast all day: picked by the date, not at random.
export function forecastFor(ms: number) {
  const day = localDay(ms)
  let h = 0
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const sky = FORECAST_SKY[h % FORECAST_SKY.length] ?? ''
  const luck = FORECAST_LUCK[Math.floor(h / FORECAST_SKY.length) % FORECAST_LUCK.length] ?? ''
  return `Dự báo hôm nay: ${sky}. ${luck}`
}

let jokeAt = 0

// ---- splash (34)
const LOGO = ['╔═╗╦  ╔═╗╦ ╦╔╦╗╔═╗', '║  ║  ╠═╣║ ║ ║║║╣ ', '╚═╝╩═╝╩ ╩╚═╝═╩╝╚═╝']
const TIPS = [
  'Bấm [Cài đặt] để bật/tắt nhanh mọi tính năng.',
  '/mods theme dracula để đổi màu cả giao diện.',
  'Gõ ;fix sau khi lưu bằng /mods abbrev ;fix <nội dung>.',
  '/mods rule <luật> để Claude luôn nhớ quy ước của dự án.',
  '/mods timer 25 cho một phiên pomodoro.',
  'Bôi đen một đoạn rồi bấm [Chọn] để giải thích hoặc dịch.',
  '/mods find <từ> tìm lại mọi thứ trong hội thoại.',
  '/mods stats xem bạn đã tiêu bao nhiêu tuần này.',
]

async function buildSplash($: EngineInterface, loaded?: Stats) {
  const now = await $.clock.now()
  const hour = new Date(now).getHours()
  const greet =
    hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const who = baseName(await read($, home)) || 'bạn'
  const stats = loaded ?? (await loadStats($))
  const today = localDay(now)
  const prev = Object.keys(stats)
    .filter(d => d < today)
    .sort()
    .pop()
  let lastLine = 'Chưa có số liệu lần trước, bắt đầu thôi!'
  if (prev) {
    const rows = stats[prev] ?? {}
    const sum = Object.values(rows).reduce(
      (a, r) => ({ turns: a.turns + r.turns, seconds: a.seconds + r.seconds, usd: a.usd + r.usd }),
      { turns: 0, seconds: 0, usd: 0 },
    )
    lastLine = `Lần trước (${prev}): ${sum.turns} lượt · ${duration(sum.seconds * 1000)} · $${sum.usd.toFixed(2)} · ${Object.keys(rows).join(', ')}`
  }
  const info: SplashInfo = {
    greeting: `${greet}, ${who} 👋`,
    last: lastLine,
    tip: `💡 ${TIPS[Math.floor(now / 60000) % TIPS.length] ?? ''}`,
    forecast: `🔮 ${forecastFor(now)}`,
  }
  await update($, splashInfo, () => info)
}

// ================================================================ productivity
// ---- per-project lists kept in $.store under the project root
async function saveProjectValue($: EngineInterface, key: string, value: unknown) {
  const raw = await $.store.get(key)
  const all = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {}
  all[await read($, root)] = value
  await $.store.set(key, all)
}

// Related tests after an edit: the runner is read from package.json; no runner, no run.
// One run at a time: files edited while it runs join the next run.
const relatedWaiting = new Set<string>()
let relatedRunning = false
async function relatedTests($: EngineInterface, file: string) {
  relatedWaiting.add(file)
  if (relatedRunning) return
  relatedRunning = true
  try {
    while (relatedWaiting.size > 0) {
      const batch = [...relatedWaiting]
      relatedWaiting.clear()
      const dir = await read($, root)
      const argv = relatedCommand(await $.fs.read(`${dir}/package.json`).catch(() => ''), batch)
      if (!argv) return
      const run = await $.process.run(argv, { cwd: dir, timeoutMs: 60000 }).catch(() => undefined)
      const names = batch.map(baseName).join(', ')
      void notice($, run?.exitCode === 0 ? `✅ Test liên quan ${names} qua` : `❌ Test liên quan ${names} lỗi`)
    }
  } finally {
    relatedRunning = false
    relatedWaiting.clear()
  }
}

async function historyCommand($: EngineInterface, query: string) {
  if (!query) return 'Dùng: /mods history <từ khoá>'
  const own = (await $.session.messages()).filter(m => m.role === 'user').map(m => m.text)
  const dir = `${await read($, home)}/.claude/projects/${(await read($, root)).replace(/[^A-Za-z0-9]/g, '-')}`
  const saved: string[] = []
  try {
    // ponytail: first 8 transcripts in listing order, not newest; sort by mtime if the list gives it.
    const files = (await $.fs.list(dir)).filter(f => f.name.endsWith('.jsonl')).slice(0, 8)
    for (const f of files) saved.push(...transcriptPrompts((await $.fs.read(`${dir}/${f.name}`)).split('\n')))
  } catch {
    // No transcripts for this project yet.
  }
  const hits = searchPrompts([...own, ...saved], query)
  return hits.length ? hits.map(h => `• ${h.slice(0, 160).replace(/\s+/g, ' ')}`).join('\n') : `Không có prompt nào khớp "${query}".`
}

async function prCommand($: EngineInterface) {
  const dir = await read($, root)
  if (!(await gitIsSafe($, dir))) return 'Bỏ qua: .git/config của repo này khai báo chương trình git sẽ chạy.'
  const hasMain = await $.process.run([...SAFE_GIT, '-C', dir, 'rev-parse', '--verify', '--quiet', 'main'], { timeoutMs: 3000 })
  const base = hasMain.exitCode === 0 ? 'main' : 'master'
  const [log, stat] = await Promise.all([
    $.process.run([...SAFE_GIT, '-C', dir, 'log', '--format=%s', `${base}..HEAD`], { timeoutMs: 5000 }),
    $.process.run([...SAFE_GIT, '-C', dir, 'diff', '--stat', `${base}...HEAD`], { timeoutMs: 5000 }),
  ])
  if (log.exitCode !== 0) return `Không so được với ${base} (nhánh chưa có?).`
  return prDraft(log.stdout, stat.stdout)
}

// The session as Markdown: each message under its speaker, then the files Claude changed.
async function exportCommand($: EngineInterface) {
  const dir = await read($, home)
  if (!dir) return 'Chưa xác định được thư mục nhà để xuất.'
  const messages = (await $.session.messages()).filter(m => m.text.trim())
  if (!messages.length) return 'Chưa có tin nhắn nào để xuất.'
  const now = await $.clock.now()
  const d = new Date(now)
  const path = `${dir}/.claude/mods-export-${localDay(now)}-${pad2(d.getHours())}${pad2(d.getMinutes())}.md`
  const touched = await read($, files)
  const doc = [
    `# ${(await read($, project)) || 'Phiên làm việc'} · ${localDay(now)}`,
    '',
    ...(touched.length ? ['## File đã sửa', ...touched.map(f => `- ${f}`), ''] : []),
    ...messages.flatMap(m => [`## ${m.role === 'user' ? 'Bạn' : 'Claude'}`, '', m.text.trim(), '']),
  ].join('\n')
  await $.fs.write(path, doc)
  return `Đã xuất ${messages.length} tin nhắn: ${path}`
}

async function pinCommand($: EngineInterface) {
  const answer = await read($, lastAnswer)
  if (!answer) return 'Chưa có câu trả lời nào để ghim.'
  await setNotes($, l => [...l, pinText(answer)])
  return 'Đã ghim câu trả lời gần nhất vào ghi chú.'
}

async function quotaCommand($: EngineInterface) {
  const limits = (await read($, usage))?.limits ?? []
  if (limits.length === 0) return 'Chưa có số liệu giới hạn (chỉ có khi dùng gói đăng ký).'
  const now = await $.clock.now()
  return limits.map(l => `${LIMIT_LABEL[l.kind] ?? l.kind}: ${l.percent}% · reset sau ${formatReset(l.resetsAt, now)}`).join('\n')
}

// ---- budget (38): today's spend from the stats, a daily limit in $.store
async function refreshSpend($: EngineInterface, loaded?: Stats) {
  const stats = loaded ?? (await loadStats($))
  const today = Object.values(stats[localDay(await $.clock.now())] ?? {}).reduce((n, r) => n + r.usd, 0)
  if (!same(await read($, spentToday), today)) await update($, spentToday, () => today)
  const raw = await $.store.get('budget')
  const limit = typeof raw === 'number' && raw > 0 ? raw : 0
  if (!same(await read($, budgetLimit), limit)) await update($, budgetLimit, () => limit)
}

const last7Days = (now: number) => Array.from({ length: 7 }, (_, i) => localDay(now - i * 86400000))

async function weekSpent($: EngineInterface) {
  return spendSince(await loadStats($), last7Days(await $.clock.now()))
}

async function weekBudgetCommand($: EngineInterface, rest: string) {
  if (rest === 'off' || rest === '0') {
    await $.store.set('budgetweek', 0)
    return 'Đã bỏ giới hạn chi tiêu 7 ngày.'
  }
  const amount = Number.parseFloat(rest.replace('$', ''))
  if (rest && amount > 0) {
    await $.store.set('budgetweek', amount)
    return `Giới hạn 7 ngày: $${amount.toFixed(2)}. 7 ngày qua đã dùng $${(await weekSpent($)).toFixed(2)}.`
  }
  const raw = await $.store.get('budgetweek')
  const limit = typeof raw === 'number' && raw > 0 ? raw : 0
  return `7 ngày qua: $${(await weekSpent($)).toFixed(2)}${limit ? ` / $${limit.toFixed(2)}` : ' (chưa đặt giới hạn)'}. Đặt: /mods budget week 30 · bỏ: /mods budget week off`
}

async function budgetCommand($: EngineInterface, rest: string) {
  if (rest.startsWith('week')) return weekBudgetCommand($, rest.slice(4).trim())
  if (rest === 'off' || rest === '0') {
    await $.store.set('budget', 0)
    await refreshSpend($)
    return 'Đã bỏ giới hạn chi tiêu.'
  }
  const amount = Number.parseFloat(rest.replace('$', ''))
  if (rest && amount > 0) {
    await $.store.set('budget', amount)
    await refreshSpend($)
    return `Giới hạn chi tiêu: $${amount.toFixed(2)}/ngày. Hôm nay đã dùng $${(await read($, spentToday)).toFixed(2)}.`
  }
  const limit = await read($, budgetLimit)
  return `Hôm nay: $${(await read($, spentToday)).toFixed(2)}${limit ? ` / $${limit.toFixed(2)}` : ' (chưa đặt giới hạn)'}. Đặt: /mods budget 5 · bỏ: /mods budget off`
}

// ---- secrets (39): spellings of credentials that should not ride in a prompt
const SECRET_PATTERNS: readonly [RegExp, string][] = [
  [/-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/, 'GitHub token'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API key'],
  [/\bsk-(proj-)?[A-Za-z0-9_-]{32,}/, 'OpenAI API key'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\b(sk|rk)_live_[0-9A-Za-z]{20,}/, 'Stripe live key'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT'],
  // A value with a digit and no `.`/`(`: `password = hunter2x9`, not `password: user.password`.
  [
    /\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"]?(?=[^\s'".()]*\d)[^\s'".()]{8,}/i,
    'mật khẩu/secret dạng key=value',
  ],
]
const secretIn = (text: string) => SECRET_PATTERNS.find(([re]) => re.test(text))?.[1]

// ---- checkpoints (40): the file as it was, before Claude's Edit or Write
let checkpointSeq = 0

// Returns the checkpoint's id, so a call that then fails can take it back.
// cp keeps the bytes: $.fs.read/write go through a string and would mangle a binary file.
// Returns the error text, or '' on success.
export async function copyFile($: EngineInterface, from: string, to: string) {
  for (const argv of [['mkdir', '-p', '--', to.slice(0, to.lastIndexOf('/')) || '/'], ['cp', '--', from, to]]) {
    const run = await $.process.run(argv, { timeoutMs: 10000 })
    if (run.exitCode !== 0) return run.stderr.trim() || `${argv[0]} exit ${run.exitCode}`
  }
  return ''
}

async function snapshot($: EngineInterface, path: string) {
  const dir = await read($, home)
  if (!dir) return undefined
  const id = Date.now() * 1000 + (checkpointSeq++ % 1000)
  let copy: string | null = null
  if (await $.fs.exists(path)) {
    copy = `${dir}/.claude/mods-checkpoints/${await $.session.id()}/${id}-${baseName(path)}`
    const failed = await copyFile($, path, copy)
    if (failed) throw new Error(`checkpoint ${path}: ${failed}`)
  }
  const point: Checkpoint = { id, path, copy, at: await $.clock.now() }
  await update($, checkpoints, list => [...list, point].slice(-MAX_CHECKPOINTS))
  return id
}

async function undoCommand($: EngineInterface, rest: string) {
  const list = await read($, checkpoints)
  const wanted = rest ? list.filter(c => c.path.endsWith(rest)) : list
  const point = wanted[wanted.length - 1]
  if (!point) return rest ? `Không có checkpoint nào cho "${rest}".` : 'Chưa có checkpoint nào trong session này.'
  if (point.copy) {
    const failed = await copyFile($, point.copy, point.path)
    if (failed) return `✗ Không khôi phục được ${point.path}: ${failed}`
  } else {
    const run = await $.process.run(['rm', '--', point.path], { timeoutMs: 5000 })
    if (run.exitCode !== 0) return `✗ Không xóa được file mới ${point.path}: ${run.stderr.trim()}`
  }
  await update($, checkpoints, l => l.filter(c => c.id !== point.id))
  return point.copy
    ? `↩ Đã khôi phục ${point.path} về trước lần sửa lúc ${new Date(point.at).toLocaleTimeString()}.`
    : `↩ Đã xóa ${point.path} (file do Claude tạo mới).`
}

const checkpointsText = (list: Checkpoint[]) =>
  list.length
    ? [
        'Checkpoint (mới nhất cuối):',
        ...list.slice(-15).map(c => `  ${new Date(c.at).toLocaleTimeString()}  ${c.copy ? 'sửa' : 'mới'}  ${c.path}`),
        'Hoàn tác: /mods undo [đuôi tên file]',
      ].join('\n')
    : 'Chưa có checkpoint nào trong session này.'

// ---- branch lock (41)
const PROTECTED_BRANCHES = ['main', 'master', 'production']

function branchLockReason(command: string, branch: string | undefined) {
  const onProtected = !!branch && PROTECTED_BRANCHES.includes(branch)
  for (const words of shellSegments(command)) {
    const git = gitCommand(words)
    if (git?.sub === 'commit' && onProtected) return `commit thẳng lên ${branch}`
    if (git?.sub === 'push') {
      const refs = git.args.filter(a => !a.startsWith('-'))
      const named = refs
        .slice(1)
        .map(pushTarget)
        .find(t => PROTECTED_BRANCHES.includes(t))
      if (named) return `push thẳng lên ${named}`
      // No refspec after the remote: the current branch is what gets pushed.
      if (onProtected && refs.length <= 1) return `push từ nhánh ${branch}`
    }
  }
  return undefined
}

// ---- auto-format (42): the project's own formatter, only where it exists
async function formatFile($: EngineInterface, path: string) {
  const base = await read($, root)
  if (!base || !path.startsWith(`${base}/`)) return
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const prettier = `${base}/node_modules/.bin/prettier`
  const plans: string[][] = []
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'md', 'html', 'yml', 'yaml'].includes(ext)) {
    if (await $.fs.exists(prettier)) plans.push([prettier, '--write', '--log-level', 'warn', path])
  } else if (ext === 'py') {
    plans.push(['ruff', 'format', path], ['black', '-q', path])
  } else if (ext === 'go') {
    plans.push(['gofmt', '-w', path])
  } else if (ext === 'rs') {
    plans.push(['rustfmt', path])
  }
  for (const argv of plans) {
    try {
      const run = await $.process.run(argv, { cwd: base, timeoutMs: 20000 })
      if (run.exitCode === 0) return
    } catch {
      // Not installed: try the next formatter.
    }
  }
}

// ---- auto-check (43): one command per project, run after a turn that edited files
async function runCheck($: EngineInterface) {
  const command = await read($, checkCommand)
  if (!command) return
  const base = (await read($, root)) || undefined
  void notice($, `⏳ Đang kiểm tra: ${command}`)
  try {
    const run = await $.process.run(['sh', '-c', command], { cwd: base, timeoutMs: 180000 })
    const value: CheckResult = {
      ok: run.exitCode === 0,
      command,
      output: `${run.stdout}${run.stderr}`.trim().split('\n').slice(-12).join('\n'),
      at: await $.clock.now(),
    }
    await update($, check, () => value)
    void notice($, value.ok ? `✓ Kiểm tra pass: ${command}` : `✗ Kiểm tra lỗi: ${command}`)
    if (value.ok) void startFx($, 'party')
  } catch (error) {
    const value: CheckResult = {
      ok: false,
      command,
      output: error instanceof Error ? error.message : String(error),
      at: await $.clock.now(),
    }
    await update($, check, () => value)
  }
}

async function checkCommandText($: EngineInterface, rest: string) {
  if (rest === 'off') {
    await update($, checkCommand, () => '')
    await saveProjectValue($, 'checks', '')
    return 'Đã bỏ lệnh kiểm tra của dự án này.'
  }
  if (rest === 'run' || (!rest && (await read($, checkCommand)))) {
    await runCheck($)
    const r = await read($, check)
    return r ? `${r.ok ? '✓ pass' : '✗ lỗi'}: ${r.command}\n${r.output}` : 'Chưa đặt lệnh kiểm tra.'
  }
  if (!rest) return 'Đặt lệnh kiểm tra cho dự án: /mods check "pnpm test" · chạy: /mods check run · bỏ: /mods check off'
  const command = rest.replace(/^["']|["']$/g, '')
  await update($, checkCommand, () => command)
  await saveProjectValue($, 'checks', command)
  return `Lệnh kiểm tra của dự án: ${command}${(await read($, settings)).autocheck ? '' : '\n(Bật tự chạy sau mỗi lượt: /mods autocheck)'}`
}

// ---- commit (44): Haiku drafts a message from the staged diff
async function draftCommit($: EngineInterface) {
  const base = await read($, root)
  if (!(await gitIsSafe($, base))) {
    await update($, commitDraft, () => ({
      message: '',
      files: 0,
      note: 'Bỏ qua: config của repo này khai báo chương trình git sẽ chạy.',
    }))
    return
  }
  const staged = await $.process.run(
    [...SAFE_GIT, '-C', base, 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--stat'],
    {
      timeoutMs: 5000,
    },
  )
  const count = staged.stdout.split('\n').filter(l => l.includes('|')).length
  if (count === 0) {
    await update($, commitDraft, () => ({
      message: '',
      files: 0,
      note: 'Chưa có gì được stage. Bấm "Stage tất cả" hoặc tự git add.',
    }))
    return
  }
  const patch = await $.process.run(
    [...SAFE_GIT, '-C', base, 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all'],
    { timeoutMs: 10000 },
  )
  const reply = await $.model.complete({
    model: 'haiku',
    maxTokens: 300,
    timeoutMs: 20000,
    system:
      'Write one git commit message for this staged diff in Conventional Commits form: a subject line under 72 characters (type: summary), then optionally a blank line and a short body saying why. Output only the message.',
    prompt: `${staged.stdout}\n\n${patch.stdout.slice(0, 12000)}`,
  })
  const message = reply.isAnswered
    ? reply.text
        .trim()
        .replace(/^```\w*\n?|```$/g, '')
        .trim()
    : ''
  await update($, commitDraft, () => ({
    message,
    files: count,
    note: reply.isAnswered ? '' : 'Haiku không trả lời; gõ message vào ô bên dưới.',
  }))
}

// git add -A, then unstage what the guard protects (.env, keys): staging
// everything must not quietly put a secret into the next commit.
async function stageAll($: EngineInterface, base: string) {
  await $.process.run([...SAFE_GIT, '-C', base, 'add', '-A'], { timeoutMs: 10000 })
  const staged = await $.process.run([...SAFE_GIT, '-C', base, 'diff', '--cached', '--name-only'], { timeoutMs: 5000 })
  const secret = staged.stdout.split('\n').filter(f => f && isSecretFile(f))
  if (secret.length) {
    await $.process.run([...SAFE_GIT, '-C', base, 'reset', '-q', '--', ...secret], { timeoutMs: 5000 })
    void notice($, `🔐 Đã bỏ stage: ${secret.join(', ')}`)
  }
}

async function commitNow($: EngineInterface) {
  const draft = await read($, commitDraft)
  if (!draft?.message) return
  const base = await read($, root)
  if (!(await gitIsSafe($, base))) return
  const run = await $.process.run([...SAFE_GIT, '-C', base, 'commit', '-m', draft.message], { timeoutMs: 30000 })
  void notice(
    $,
    run.exitCode === 0
      ? `✓ Đã commit: ${draft.message.split('\n')[0]}`
      : `✗ Commit lỗi: ${run.stderr.trim().slice(0, 200)}`,
  )
  if (run.exitCode === 0) await update($, commitDraft, () => null)
  await refreshGit($)
}

// ---- compact (45): what a summary must keep
async function compactNotes($: EngineInterface) {
  const touched = await read($, files)
  const list = await read($, rules)
  const open = (await read($, todos)).filter(t => !t.done)
  return [
    'When summarizing, keep these explicitly:',
    touched.length ? `- Files edited this session: ${touched.join(', ')}` : '',
    list.length ? `- Project rules the user set: ${list.join(' | ')}` : '',
    open.length ? `- Open TODOs: ${open.map(t => t.text).join(' | ')}` : '',
    '- Decisions made and why, and the exact next step that was in progress.',
  ]
    .filter(Boolean)
    .join('\n')
}

// ---- todos (46): TODO/FIXME lines written into code, and "- [ ]" items in answers
function todosIn(text: string, file?: string): Todo[] {
  const found: Todo[] = []
  for (const line of text.split('\n')) {
    // TODO/FIXME only from code written to a file; an answer only gives "- [ ]" items.
    const code = file ? line.match(/\b(?:TODO|FIXME)\b[:\s-]*(.{3,160})/) : null
    const box = line.match(/^\s*[-*] \[ \] (.{3,160})/)
    const text = (code?.[1] ?? box?.[1])?.replace(/\s*(\*\/|-->)\s*$/, '').trim()
    if (text) found.push({ text, done: false, ...(code && file ? { file } : {}) })
  }
  return found.slice(0, 10)
}

async function addTodos($: EngineInterface, items: Todo[]) {
  if (items.length === 0) return
  const list = await update($, todos, l => {
    const seen = new Set(l.map(t => t.text))
    return [...l, ...items.filter(t => !seen.has(t.text))].slice(-100)
  })
  await saveProjectValue($, 'todos', list)
}

async function setTodos($: EngineInterface, change: (l: Todo[]) => Todo[]) {
  const list = await update($, todos, change)
  await saveProjectValue($, 'todos', list)
}

async function setNotes($: EngineInterface, change: (l: string[]) => string[]) {
  const list = await update($, notes, change)
  await saveProjectValue($, 'notes', list)
}

// ---- standup (48): yesterday and today from the stats and the journal
async function standupText($: EngineInterface) {
  const stats = await loadStats($)
  const now = await $.clock.now()
  const today = localDay(now)
  const yesterday = Object.keys(stats)
    .filter(d => d < today)
    .sort()
    .pop()
  const day = (d: string | undefined) =>
    d
      ? Object.entries(stats[d] ?? {}).map(
          ([name, r]) => `  • ${name}: ${r.turns} lượt, ${duration(r.seconds * 1000)}, $${r.usd.toFixed(2)}`,
        )
      : []
  const [yesterdayRows, todayRows] = [day(yesterday), day(today)]
  let edited: string[] = []
  try {
    const journal = await $.fs.read(`${await read($, home)}/.claude/mods-journal.md`)
    edited = journal
      .split('\n## ')
      .filter(entry => (yesterday && entry.startsWith(yesterday)) || entry.startsWith(today))
      .flatMap(entry => entry.split('\n').filter(l => l.startsWith('- File đã sửa:')))
      .map(l => l.replace('- File đã sửa: ', ''))
      .filter(l => l !== 'không có')
  } catch {
    // No journal yet.
  }
  const open = (await read($, todos)).filter(t => !t.done)
  return [
    `Standup ${today}`,
    `Hôm qua${yesterday ? ` (${yesterday})` : ''}:`,
    ...(yesterdayRows.length ? yesterdayRows : ['  • (không có số liệu)']),
    'Hôm nay:',
    ...(todayRows.length ? todayRows : ['  • (chưa có)']),
    ...(edited.length
      ? ['File đã động tới:', `  • ${[...new Set(edited.join(', ').split(', '))].slice(0, 15).join(', ')}`]
      : []),
    ...(open.length ? ['Đang mở:', ...open.slice(0, 8).map(t => `  • ${t.text}`)] : []),
  ].join('\n')
}

// ---- handoff (49): a summary of this session sent to another one
async function handoffCommand($: EngineInterface, rest: string) {
  if (!rest) return 'Cách dùng: /mods handoff <tên hoặc id session> (xem /mods sessions)'
  await syncPeers($)
  const target = (await read($, peers)).find(
    p => !p.isSelf && (p.name === rest || p.id.startsWith(rest) || p.name.startsWith(rest)),
  )
  if (!target) return `Không thấy session "${rest}". Xem danh sách: /mods sessions`
  const transcript = (await $.session.messages())
    .slice(-30)
    .map(m => `${m.role === 'user' ? 'USER' : 'CLAUDE'}: ${m.text.slice(0, 600)}`)
    .join('\n\n')
    .slice(-15000)
  const reply = await $.model.complete({
    model: 'haiku',
    maxTokens: 500,
    timeoutMs: 30000,
    system:
      'Write a handoff note for another Claude session taking over this work: the goal, what is done, what is in progress, the next concrete steps, and files involved. Bullets, at most 12 lines, in the language the user wrote in.',
    prompt: `${transcript}\n\nFiles edited: ${(await read($, files)).join(', ') || 'none'}`,
  })
  if (!reply.isAnswered) return `✗ Không tóm tắt được (${reply.reason}).`
  const from = (await read($, project)) || 'một session khác'
  const sent = await $.session.send({
    to: { sessionId: target.id },
    text: `Bàn giao từ ${from}:\n${reply.text.trim()}`,
  })
  return sent.isDelivered
    ? `✓ Đã bàn giao cho ${target.name}:\n${reply.text.trim()}`
    : `✗ Không gửi được tới ${target.name}: ${sent.reason}`
}

// ---- copy (50): the nth latest code block in Claude's answers
async function copyCommand($: EngineInterface, rest: string) {
  const nth = Math.max(1, Number.parseInt(rest, 10) || 1)
  const blocks = (await $.session.messages())
    .filter(m => m.role === 'assistant')
    .flatMap(m => [...m.text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(x => x[1] ?? ''))
  const block = blocks[blocks.length - nth]
  if (block === undefined) return blocks.length ? `Chỉ có ${blocks.length} khối code.` : 'Chưa có khối code nào.'
  const copied = await $.ui.copy({ text: block.replace(/\n$/, '') })
  const lines = block.split('\n').length - 1
  return copied.isCopied
    ? `📋 Đã copy khối code thứ ${nth} từ cuối (${lines} dòng).`
    : `✗ Không copy được (${copied.reason}).`
}

// ---- context (51)
// Same rate-limited endpoint as refreshUsage: a press or /mods context within 10 s keeps the last
// figure, and a failure (a 429) keeps it too instead of throwing into a void'd button handler.
const BREAKDOWN_MIN_MS = 10_000
let breakdownAt = 0

async function refreshBreakdown($: EngineInterface) {
  const now = await $.clock.now()
  if (now - breakdownAt < BREAKDOWN_MIN_MS) return
  breakdownAt = now
  const u = await $.session.usage({ breakdown: 'summary' }).catch(() => null)
  if (!u) return
  const b = u.context.breakdown
  if (!b) {
    await update($, breakdown, () => null)
    return
  }
  const value: Breakdown = {
    categories: b.categories
      .filter(c => c.tokens > 0 && !c.isDeferred)
      .map(c => ({ name: c.name, tokens: c.tokens, color: c.color })),
    total: b.totalTokens,
    max: b.maxTokens,
  }
  await update($, breakdown, () => value)
}

const openTodo = ($: EngineInterface) => $.ui.open({ id: TODO_PANE, title: 'TODO' })
const openNotes = ($: EngineInterface) => $.ui.open({ id: NOTES_PANE, title: 'Ghi chú' })
const openCommit = ($: EngineInterface) => $.ui.open({ id: COMMIT_PANE, title: 'Commit' })
const openContext = ($: EngineInterface) => $.ui.open({ id: CONTEXT_PANE, title: 'Context' })
const openReplay = async ($: EngineInterface) => {
  await update($, replayAt, () => 0)
  return $.ui.open({ id: REPLAY_PANE, title: 'Replay' })
}

// ---- replay: each successful edit of the running turn becomes a step; the
// turn's end publishes them, so a turn without edits keeps the last replay.
let turnSteps: Step[] = []
const REPLAY_LINES = 12
const MAX_STEPS = 100

// The changed lines of before → after, one line of context around each run,
// capped at REPLAY_LINES. Lines are matched by position after trimming the
// common head and tail, which is what an Edit's old/new strings are anyway.
export function editDiff(before: string, after: string): Omit<Step, 'path' | 'tool'> {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const removed = a.slice(head, a.length - tail)
  const added = b.slice(head, b.length - tail)
  const lines = [
    ...(head > 1 ? ['⋯'] : []),
    ...(head > 0 ? [` ${a[head - 1]}`] : []),
    ...removed.map(l => `-${l}`),
    ...added.map(l => `+${l}`),
    ...(tail > 0 ? [` ${a[a.length - tail]}`] : []),
    ...(tail > 1 ? ['⋯'] : []),
  ]
  const shown = lines.slice(0, REPLAY_LINES)
  if (lines.length > REPLAY_LINES) shown.push(`… ${lines.length - REPLAY_LINES} dòng nữa`)
  return { diff: shown.join('\n'), added: added.length, removed: removed.length }
}

// ---- prompt lint: a short prompt that points ("it", "cái này") at nothing named.
const VAGUE = /\b(this|that|it)\b|cái này|cái đó|chỗ này|chỗ đó|(^|\s)nó(\s|$)/i
export function vagueHint(text: string): string | null {
  const t = text.trim()
  if (!t || t.startsWith('/') || t.length >= 40 || !VAGUE.test(t)) return null
  // A file, a path, code or a number names the target well enough.
  if (/[`/\\]|\.\w{1,5}\b|\d/.test(t)) return null
  return '💡 Prompt hơi mơ hồ: nêu tên file, hành vi mong muốn hoặc lỗi cụ thể để Claude làm đúng ngay.'
}

// ---- shadow commits: each editing turn's working tree, kept on refs/mods/turns.
// A temporary index keeps the person's index, branch and HEAD untouched.
const SHADOW_REF = 'refs/mods/turns'
const SHADOW_ENV = {
  GIT_AUTHOR_NAME: 'terminal-polish',
  GIT_AUTHOR_EMAIL: 'terminal-polish@localhost',
  GIT_COMMITTER_NAME: 'terminal-polish',
  GIT_COMMITTER_EMAIL: 'terminal-polish@localhost',
}
// One run at a time: two would share the temporary index and race on the ref.
let shadowQueue: Promise<void> = Promise.resolve()
const queueShadow = ($: EngineInterface, message: string) =>
  (shadowQueue = shadowQueue.then(() => shadowCommit($, message)).catch(() => undefined))

async function shadowCommit($: EngineInterface, message: string) {
  if (!(await gitIsSafe($))) return
  // Inside .git, so the temporary index is never part of the tree it snapshots.
  const where = await $.process.run([...SAFE_GIT, 'rev-parse', '--path-format=absolute', '--git-path', 'mods-shadow.index'], {
    timeoutMs: 3000,
  })
  if (where.exitCode !== 0 || !where.stdout.trim()) return
  const env = { ...SHADOW_ENV, GIT_INDEX_FILE: where.stdout.trim() }
  const git = (args: string[]) => $.process.run([...SAFE_GIT, ...args], { env, timeoutMs: 20000 })
  const [prev, head] = await Promise.all([
    git(['rev-parse', '-q', '--verify', SHADOW_REF]),
    git(['rev-parse', '-q', '--verify', 'HEAD']),
  ])
  if (head.exitCode === 0 && (await git(['read-tree', 'HEAD'])).exitCode !== 0) return
  if ((await git(['add', '-A'])).exitCode !== 0) return
  const tree = (await git(['write-tree'])).stdout.trim()
  if (!tree) return
  const parent = prev.exitCode === 0 ? prev.stdout.trim() : head.exitCode === 0 ? head.stdout.trim() : ''
  const made = await git(['-c', 'commit.gpgsign=false', 'commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message])
  const sha = made.stdout.trim()
  // Only move the ref from the value read above: another session's run is never overwritten.
  const old = prev.exitCode === 0 ? prev.stdout.trim() : '0'.repeat(40)
  if (made.exitCode === 0 && sha) await git(['update-ref', SHADOW_REF, sha, old])
}

async function turnsCommand($: EngineInterface) {
  if (!(await gitIsSafe($))) return 'Không chạy git ở repo này (.git/config khai báo chương trình git sẽ chạy).'
  const log = await $.process.run([...SAFE_GIT, 'log', '-n', '15', '--format=%h  %cr  %s', SHADOW_REF], { timeoutMs: 5000 })
  if (log.exitCode !== 0 || !log.stdout.trim())
    return 'Chưa có commit nháp. Bật bằng /mods shadow, rồi mỗi lượt có sửa file sẽ được lưu.'
  return [
    `Commit nháp theo lượt (${SHADOW_REF}):`,
    log.stdout.trimEnd(),
    '',
    'Xem thay đổi của một lượt:  git show --stat <sha>',
    'Lấy lại một file từ lượt đó: git checkout <sha> -- <file>',
  ].join('\n')
}

// ---- changelog: today's commit subjects, grouped by their conventional type.
export function changelogOf(subjects: string[], day: string) {
  const groups: [string, RegExp][] = [
    ['Tính năng', /^feat(\(.+?\))?!?:\s*/],
    ['Sửa lỗi', /^fix(\(.+?\))?!?:\s*/],
  ]
  const sections = new Map<string, string[]>()
  for (const subject of subjects) {
    if (/^chore(\(.+?\))?: release\b/.test(subject) || /^Merge /.test(subject)) continue
    const hit = groups.find(([, re]) => re.test(subject))
    const name = hit?.[0] ?? 'Khác'
    sections.set(name, [...(sections.get(name) ?? []), hit ? subject.replace(hit[1], '') : subject])
  }
  if (sections.size === 0) return null
  const order = ['Tính năng', 'Sửa lỗi', 'Khác'].filter(n => sections.has(n))
  return [`## ${day}`, ...order.flatMap(n => ['', `### ${n}`, ...(sections.get(n) ?? []).map(l => `- ${l}`)])].join('\n')
}

async function changelogCommand($: EngineInterface, rest: string) {
  if (!(await gitIsSafe($))) return 'Không chạy git ở repo này (.git/config khai báo chương trình git sẽ chạy).'
  const log = await $.process.run([...SAFE_GIT, 'log', '--since=midnight', '--no-merges', '--format=%s'], { timeoutMs: 5000 })
  if (log.exitCode !== 0) return 'Không đọc được git log (không phải git repo?).'
  const text = changelogOf(lines(log.stdout), localDay(await $.clock.now()))
  if (!text) return 'Hôm nay chưa có commit nào để ghi changelog.'
  if (rest === 'write') {
    const path = `${(await read($, root)) || '.'}/CHANGELOG.md`
    let before = ''
    try {
      before = await $.fs.read(path)
    } catch (error) {
      if (await $.fs.exists(path)) throw error
    }
    const day = text.split('\n')[0] ?? ''
    if (before.split(/\r?\n/).includes(day)) return `CHANGELOG.md đã có mục ${day.slice(3)}; sửa tay nếu cần thêm.`
    const head = /^# [^\n]*\n+/.exec(before)?.[0] ?? ''
    await $.fs.write(path, `${head || '# Changelog\n\n'}${text}\n\n${before.slice(head.length)}`.trimEnd() + '\n')
    return `✓ Đã ghi vào ${path}:\n${text}`
  }
  const copied = await $.ui.copy({ text })
  return `${text}${copied.isCopied ? '\n📋 Đã copy. /mods changelog write để ghi vào CHANGELOG.md.' : ''}`
}

// ---- AI monitor: every model response, by the agent loop that made it.
// ponytail: list prices per MTok as of 2026-10 [input, output, cache read, cache write];
// cache write assumed 1.25× input where unpublished. The engine only totals the
// session's real cost, so per-agent dollars are estimates; update when prices move.
const PRICES: [RegExp, readonly [number, number, number, number]][] = [
  [/fable|mythos/, [10, 50, 0.25, 12.5]],
  [/opus-5-5/, [4, 20, 0.2, 5]],
  [/opus-4(-1)?($|-20)/, [15, 75, 1.5, 18.75]],
  [/opus/, [5, 25, 0.5, 6.25]],
  [/sonnet-5/, [2, 10, 0.2, 2.5]],
  [/sonnet/, [3, 15, 0.3, 3.75]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.125]],
  [/haiku/, [1, 5, 0.1, 1.25]],
]
export function usdOf(model: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }) {
  const p = PRICES.find(([re]) => re.test(model))?.[1]
  if (!p) return 0
  return (u.input_tokens * p[0] + u.output_tokens * p[1] + u.cache_read_input_tokens * p[2] + u.cache_creation_input_tokens * p[3]) / 1e6
}
const tok = (n: number) => (n < 1000 ? `${n}` : n < 1e6 ? `${(n / 1000).toFixed(1)}k` : `${(n / 1e6).toFixed(2)}M`)
const shortModel = (m: string) => m.replace(/^claude-/, '')
async function recordStep(
  $: EngineInterface,
  agentId: string | undefined,
  effort: string | number | undefined,
  u: { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number },
) {
  const id = agentId ?? 'main'
  const now = await $.clock.now()
  const usd = usdOf(u.model, u)
  await update($, agentStats, list => {
    const was = list.find(a => a.id === id)
    const row: AgentStat = {
      id,
      model: u.model,
      effort: effort === undefined ? '' : String(effort),
      startedAt: was?.startedAt ?? now,
      lastAt: now,
      steps: (was?.steps ?? 0) + 1,
      input: (was?.input ?? 0) + u.input_tokens,
      output: (was?.output ?? 0) + u.output_tokens,
      cacheRead: (was?.cacheRead ?? 0) + u.cache_read_input_tokens,
      cacheWrite: (was?.cacheWrite ?? 0) + u.cache_creation_input_tokens,
      context: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens,
      usd: (was?.usd ?? 0) + usd,
    }
    return [row, ...list.filter(a => a.id !== id)].slice(0, 50)
  })
}
const openMonitor = ($: EngineInterface) => $.ui.open({ id: MONITOR_PANE, title: 'AI monitor' })

const openAccounts = ($: EngineInterface) => $.ui.open({ id: ACCOUNTS_PANE, title: 'Tài khoản Claude' })

// ---- accounts: claude-swap's profiles. Every action goes through its /profile command,
// so this mod never reads or writes a credential.
const PROFILE_NAME = /^\w[\w.-]*$/

// `note` replaces the pane's message; a failed reload keeps the last list.
async function loadAccounts($: EngineInterface, note = '') {
  const ran = await $.command.run({ command: 'profile', args: 'list --json' }).catch(() => null)
  let list: Account[] | null = null
  try {
    const data = JSON.parse(ran?.text?.trim() ?? '') as { profiles: Account[] }
    list = data.profiles.map(p => ({ name: p.name, email: p.email, active: p.active, disabled: p.disabled }))
  } catch {
    note ||= ran?.text?.trim() || 'Cần cài plugin claude-swap (lệnh /profile).'
  }
  await update($, accounts, a => ({ list: list ?? a?.list ?? [], note }))
}

async function accountRun($: EngineInterface, args: string) {
  const ran = await $.command
    .run({ command: 'profile', args })
    .catch((err: unknown) => ({ text: `❌ ${err instanceof Error ? err.message : String(err)}` }))
  const note = ran.text?.trim() ?? ''
  await loadAccounts($, note)
  return note
}

// ---- notices: the engine's toast (text only) with an icon, and a colored,
// bordered card on the band for a few seconds.
const NOTICE_MS = 6000
const NOTICE_KINDS: readonly [RegExp, string, Notice['kind']][] = [
  [/^(✓|✅|🎉)/u, '', 'ok'],
  [/^(✗|❌)/u, '', 'err'],
  [/^(🛡|🔐|⚠)/u, '', 'warn'],
  [/^(💰)/u, '', 'pink'],
  [/^(⏰|⏱|⏳)/u, '', 'warn'],
  [/^(🔔|💡|📋|📨|↩)/u, '', 'info'],
]
let noticeSeq = 0

async function notice($: EngineInterface, raw: string) {
  const matched = NOTICE_KINDS.find(([re]) => re.test(raw))
  const text = matched ? raw : /^Context/.test(raw) ? `🧠 ${raw}` : `💬 ${raw}`
  const kind: Notice['kind'] = matched?.[2] ?? (/^Context/.test(raw) ? 'warn' : 'info')
  $.ui.toast(text, { timeoutMs: NOTICE_MS })
  // Callers fire and forget (void notice): a failed state write must not surface as an unhandled rejection.
  try {
    if (!(await read($, settings)).notices) return
    const [icon = '💬', ...rest] = [...text]
    const item: Notice = { id: ++noticeSeq, icon, kind, text: rest.join('').trim() }
    await update($, notices, l => [...l, item].slice(-3))
    $.clock.after(NOTICE_MS, () => void update($, notices, l => l.filter(n => n.id !== item.id)).catch(() => undefined))
  } catch {
    // The toast above already showed it.
  }
}

// ---- blast radius (after Anthropic's blast-radius sample mod): a risky shell
// command is held, what it would change is shown on the band, and the person
// runs or cancels it. The catastrophic ones (dangerOf) stay denied outright.
export type BlastKind =
  | { kind: 'rm'; targets: string[] }
  | { kind: 'reset' }
  | { kind: 'discard' }
  | { kind: 'clean'; flags: string[] }
  | { kind: 'push'; remote: string; branch?: string }

// Words that may stand before the command they run: `sudo rm`, `FOO=1 git`, `then rm`.
const LEAD = new Set(['sudo', 'env', 'command', 'exec', 'time', 'nice', 'nohup', 'then', 'do', 'else', '{', '!', 'xargs'])
// Where `name` runs as the segment's command, not as an argument (`docker rm`, `git rm`, `echo rm`).
function commandAt(words: string[], test: (w: string) => boolean) {
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? ''
    if (test(w)) return i
    if (!LEAD.has(w) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) && !(i > 0 && w.startsWith('-'))) return -1
  }
  return -1
}

// Every risky part of a command, not only the first: `rm -r a; git reset --hard`
// must show both before anyone presses Run.
export function blastAll(command: string): BlastKind[] {
  const found: BlastKind[] = []
  const add = (kind: BlastKind) => found.push(kind)
  for (const words of shellSegments(command)) {
    const at = commandAt(words, w => w === 'rm' || w.endsWith('/rm'))
    if (at >= 0) {
      // Recursive only: `rm -f file.log` is everyday work, a hold on it would get the feature switched off.
      const { recursive, targets } = rmArgs(words.slice(at + 1))
      if (recursive && targets.length > 0) {
        add({ kind: 'rm', targets })
        continue
      }
    }
    if (commandAt(words, w => w === 'git' || w.endsWith('/git')) < 0) continue
    const git = gitCommand(words)
    if (!git) continue
    const args = git.args
    const dash = args.indexOf('--')
    if (git.sub === 'reset' && args.includes('--hard')) add({ kind: 'reset' })
    if (git.sub === 'clean' && args.some(a => a === '--force' || /^-[a-zA-Z]*f/.test(a))) {
      // Only the flags that widen what is removed; -e takes a value and is left out.
      const wide = [...new Set(args.filter(a => /^-[a-zA-Z]+$/.test(a)).flatMap(a => [...a.slice(1)]))].filter(c => 'dxX'.includes(c))
      add({ kind: 'clean', flags: wide.length ? [`-${wide.join('')}`] : [] })
    }
    if (git.sub === 'checkout' && (dash >= 0 ? args.slice(dash + 1) : args).includes('.')) add({ kind: 'discard' })
    if (git.sub === 'restore' && args.includes('.') && !args.includes('--staged')) add({ kind: 'discard' })
    if (git.sub === 'push') {
      const refs = args.filter(a => !a.startsWith('-'))
      const force = args.some(a => a.startsWith('--force') || (/^-[a-zA-Z]+$/.test(a) && a.includes('f')))
      if (force || refs.slice(1).some(r => r.startsWith('+')))
        add({ kind: 'push', remote: refs[0] ?? 'origin', branch: refs[1] ? pushTarget(refs[1]) : undefined })
    }
  }
  return found
}

const BLAST_WAIT_MS = 10 * 60 * 1000
const BLAST_ROWS = 8
const BLAST_MEASURE = 200
const blastAnswers = new Map<string, 'run' | 'cancel'>()
const blastWaiters = new Map<string, () => void>()
// Off in `claude -p` and the SDK: nobody is there to press a button.
let interactive = true
// One hold at a time (parallel subagents): the card has one slot, so a second waits its turn.
let blastGate: Promise<unknown> = Promise.resolve()

const lines = (out: string) => out.split('\n').filter(Boolean)
const kb = (k: number) => (k >= 1024 * 1024 ? `${(k / 1024 / 1024).toFixed(1)} GB` : k >= 1024 ? `${(k / 1024).toFixed(1)} MB` : `${k} KB`)
const unmeasured = (why: string) => ({ title: 'Không đo được lệnh này sẽ thay đổi gì', lines: [], note: why })

// What the command would change, measured with argv and read-only git: the
// command itself never runs here. Measured in the session's directory.
// ponytail: a leading `cd dir &&` is not followed; the report says where it measured.
async function measureBlast($: EngineInterface, kind: BlastKind, command: string): Promise<Omit<Blast, 'id' | 'command'>> {
  if (/(^|\s|&&|;)(cd|pushd)\s/.test(command)) return unmeasured('lệnh đổi thư mục trước khi chạy')
  const cwd = await $.session.cwd().catch(() => undefined)
  const where = `đo trong ${cwd ? baseName(cwd) : 'thư mục hiện tại'}`
  const run = (argv: string[], timeoutMs = 5000) => $.process.run(argv, { cwd, timeoutMs })
  if (kind.kind === 'rm') {
    // $VAR, $(…), `…`, {a,b}: the shell would turn these into other paths; measuring the text would say "nothing".
    if (kind.targets.some(t => /[$`{(]/.test(t))) return unmeasured('đường dẫn có biến hoặc lệnh con')
    const homeDir = await read($, home)
    const targets = kind.targets.map(t => (homeDir ? t.replace(/^~(?=\/|$)/, homeDir) : t))
    // Unquoted $p: the shell expands its glob, as rm would; nothing in it runs.
    const found = await run([
      'sh',
      '-c',
      'for p in "$@"; do for f in $p; do [ -e "$f" ] || [ -L "$f" ] && printf "%s\\n" "$f"; done; done',
      'sh',
      ...targets,
    ])
    if (found.exitCode !== 0) return unmeasured(where)
    const paths = lines(found.stdout)
    if (paths.length === 0) return { title: 'rm: không có gì để xóa ở đó', lines: [], note: where }
    // ./ before a relative path: a file named `-delete` must stay a path, never a find expression.
    const safe = paths.slice(0, BLAST_MEASURE).map(p => (p.startsWith('/') ? p : `./${p}`))
    const [count, size] = await Promise.all([
      run(['sh', '-c', 'find "$@" -type f 2>/dev/null | wc -l', 'sh', ...safe]),
      run(['du', '-sck', '--', ...safe]),
    ])
    const total = Number.parseInt(lines(size.stdout).pop() ?? '0', 10) || 0
    const partial = paths.length > BLAST_MEASURE ? ` (đếm ${BLAST_MEASURE} mục đầu)` : ''
    return {
      title: `rm sẽ xóa ${count.stdout.trim() || '?'} file (${kb(total)}) trong ${paths.length} mục${partial}`,
      lines: paths.slice(0, BLAST_ROWS),
      note: `${paths.length > BLAST_ROWS ? `+${paths.length - BLAST_ROWS} mục nữa · ` : ''}${where}`,
    }
  }
  if (/\bgit\s+(-C|--git-dir|--work-tree)\b/.test(command)) return unmeasured('lệnh chạy git ở thư mục khác')
  if (!(await gitIsSafe($, cwd))) return unmeasured('.git/config của repo khai báo chương trình git sẽ chạy')
  const git = (args: string[]) => run([...SAFE_GIT, ...args])
  if (kind.kind === 'reset' || kind.kind === 'discard') {
    const [status, stat] = await Promise.all([
      git(['status', '--porcelain', '--ignore-submodules=all']),
      git(['diff', '--shortstat', '--no-ext-diff', ...(kind.kind === 'reset' ? ['HEAD'] : [])]),
    ])
    if (status.exitCode !== 0) return unmeasured(`không phải git repo? · ${where}`)
    const changed = lines(status.stdout).filter(l => !l.startsWith('??') && (kind.kind === 'reset' || l[1] !== ' '))
    return {
      title: changed.length
        ? `Mất thay đổi chưa commit ở ${changed.length} file${stat.stdout.trim() ? ` (${stat.stdout.trim()})` : ''}`
        : 'Không có thay đổi nào sẽ mất',
      lines: changed.slice(0, BLAST_ROWS).map(l => l.slice(3)),
      note: changed.length > BLAST_ROWS ? `+${changed.length - BLAST_ROWS} file nữa` : '',
    }
  }
  if (kind.kind === 'clean') {
    const dry = await git(['clean', '-n', ...kind.flags])
    if (dry.exitCode !== 0) return unmeasured(`git clean -n lỗi · ${where}`)
    const gone = lines(dry.stdout).map(l => l.replace(/^Would remove /, ''))
    return {
      title: gone.length ? `git clean sẽ xóa ${gone.length} mục chưa theo dõi` : 'git clean không xóa gì',
      lines: gone.slice(0, BLAST_ROWS),
      note: gone.length > BLAST_ROWS ? `+${gone.length - BLAST_ROWS} mục nữa` : '',
    }
  }
  // A remote given as a URL has no local tracking ref to compare against.
  if (/[:/@]/.test(kind.remote)) return unmeasured('remote là URL, không có bản theo dõi trên máy')
  const head = kind.branch ? undefined : await git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = kind.branch ?? head?.stdout.trim() ?? ''
  const ref = `${kind.remote}/${branch}`
  const lost = await git(['log', '--oneline', '--no-decorate', `HEAD..${ref}`])
  if (lost.exitCode !== 0) return unmeasured(`chưa có ${ref} trên máy (chưa fetch?)`)
  const commits = lines(lost.stdout)
  return {
    title: commits.length ? `Force-push sẽ bỏ ${commits.length} commit trên ${ref}` : `Force-push lên ${ref}: không commit nào bị bỏ`,
    lines: commits.slice(0, BLAST_ROWS),
    note: `theo ${ref} lần fetch gần nhất`,
  }
}

// Holds the call until a button answers. A hook's own time is capped, but time
// inside a $ call is not: the wait is short sleeps in a process.
export function holdBlast(
  $: EngineInterface,
  id: string,
  command: string,
  kinds: BlastKind[],
  signal: AbortSignal,
  from?: string,
): Promise<'run' | 'cancel' | 'timeout'> {
  const turn = blastGate.then(() => holdOne($, id, command, kinds, signal, from))
  blastGate = turn.catch(() => undefined)
  return turn
}

async function holdOne($: EngineInterface, id: string, command: string, kinds: BlastKind[], signal: AbortSignal, from?: string) {
  if (signal.aborted) return 'cancel' as const
  const parts = await Promise.all(kinds.map(kind => measureBlast($, kind, command).catch(() => unmeasured(''))))
  // One card for every risky part: each title, then the rows, which share the space.
  const report: Omit<Blast, 'id' | 'command'> = {
    title: parts.map(p => p.title).join(' · '),
    lines: parts.flatMap(p => p.lines).slice(0, BLAST_ROWS),
    note: [...new Set(parts.map(p => p.note).filter(Boolean))].join(' · '),
  }
  const label = `${from ? `[${from}] ` : ''}${commandLabel(command)}`
  await update($, blast, () => ({ id, command: label, ...report }))
  void notice($, '⚠ Đang giữ một lệnh rủi ro: xem trên dải trạng thái; ô prompt trống thì bấm 1 chạy / 2 hủy, hoặc bấm chuột')
  try {
    await new Promise<void>(resolve => {
      if (blastAnswers.has(id) || signal.aborted) return resolve()
      let timeout: { cancel(): void } | undefined
      const wake = () => (timeout?.cancel(), resolve())
      blastWaiters.set(id, wake)
      signal.addEventListener('abort', wake, { once: true })
      timeout = $.clock.after(BLAST_WAIT_MS, resolve)
    })
    return blastAnswers.get(id) ?? (signal.aborted ? 'cancel' : 'timeout')
  } finally {
    blastAnswers.delete(id)
    blastWaiters.delete(id)
    await update($, blast, b => (b?.id === id ? null : b))
  }
}

export const answerBlast = ($: EngineInterface, id: string, answer: 'run' | 'cancel') => {
  blastAnswers.set(id, answer)
  blastWaiters.get(id)?.()
  return update($, blast, b => (b?.id === id ? null : b))
}

// Bash and Monitor alike: hold a risky command; a deny unless the person pressed Run.
export async function heldVerdict($: EngineInterface, id: string, command: string, signal: AbortSignal, agentId?: string) {
  const kinds = interactive && (await read($, settings)).blast ? blastAll(command) : []
  if (kinds.length === 0) return undefined
  const answer = await holdBlast($, id, command, kinds, signal, agentId ? 'subagent' : undefined)
  if (answer === 'run') return undefined
  return {
    deny:
      answer === 'timeout'
        ? 'terminal-polish: không ai trả lời sau 10 phút nên lệnh rủi ro này không chạy. Hỏi người dùng trước khi thử lại.'
        : 'Người dùng đã bấm Hủy sau khi xem lệnh này sẽ thay đổi gì; không có gì bị thay đổi. Hỏi họ muốn làm gì thay vào đó.',
  }
}

// The guard's verdict on one shell command (Bash or Monitor). The branch is
// read now, not from the band's state: a checkout earlier in the same turn counts.
async function shellReason($: EngineInterface, command: string) {
  const s = await read($, settings)
  const danger = s.guard ? dangerOf(command) : undefined
  if (danger || !s.branchlock || !/\bgit\b/.test(command)) return danger
  const head = await $.process.run([...SAFE_GIT, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 3000 })
  return branchLockReason(command, head.exitCode === 0 ? head.stdout.trim() : (await read($, git))?.branch)
}

// turn.step's `model` is a resolved id, not an alias: sending "haiku" there asks
// the API for a model named "haiku" and the turn falls back. The Haiku id is
// read off the session's own (claude-opus-5-5 → claude-haiku-5-5; a provider
// prefix or suffix is kept), and the step is left alone when that cannot be done.
// ponytail: assumes Haiku shares the session model's version; a release where
// they differ needs a lookup table here.
export type Effort = 'low' | 'medium' | 'high'

// Auto model for a subagent: a light model for looking things up, the strongest
// for judgment work, the middle one for the rest. The type decides first.
export function agentPlan(type: string, description: string): { model: 'haiku' | 'sonnet' | 'opus'; effort: Effort } {
  const light = { model: 'haiku', effort: 'low' } as const
  const deep = { model: 'opus', effort: 'high' } as const
  if (/^(Explore|statusline-setup|claude-code-guide)$/.test(type)) return light
  if (/plan|architect|review|security|debug|audit/i.test(type)) return deep
  const d = description.toLowerCase()
  if (/\b(review|design|architecture|debug|audit)\b/.test(d) || /thiết kế|kiến trúc|gỡ lỗi/.test(d)) return deep
  if (/\b(search|find|grep|list|look up|locate|explore)\b/.test(d) || /tìm|liệt kê/.test(d)) return light
  return { model: 'sonnet', effort: 'medium' }
}

const AUTO_MODEL_RULES = [
  'Model routing (the user turned on auto model). When you call the Agent tool, set its `model` to fit the task:',
  '- `haiku` for searching, reading and listing files;',
  '- `sonnet` for writing or editing code, tests and docs;',
  '- `opus` for architecture, design, code review and hard debugging.',
  'A `model` you set is kept; one you leave out is picked by these rules.',
].join('\n')

// The effort each running subagent asked for, by its agent id; read on every step.
// ponytail: a plain map capped at 200 entries, oldest dropped; no cleanup on agent end.
const agentEfforts = new Map<string, Effort>()
function rememberEffort(agentId: string, effort: Effort) {
  agentEfforts.set(agentId, effort)
  if (agentEfforts.size > 200) {
    const oldest = agentEfforts.keys().next().value
    if (oldest !== undefined) agentEfforts.delete(oldest)
  }
}

function haikuIdFor(model: string) {
  const base = model.replace(/\[1m\]$/, '')
  if (/haiku/.test(base)) return undefined
  const id = base.replace(/(opus|sonnet)/, 'haiku')
  return id === base ? undefined : id
}

// Everything the mod keeps in $.store, copied into $.state. Run at session.start
// and again after /clear, /resume and /branch, which reset $.state to its defaults
// and do not fire session.start.
async function loadSettingsAndTheme($: EngineInterface) {
  try {
    const [, savedTheme] = await Promise.all([loadSettings($), $.store.get('theme')])
    if (typeof savedTheme === 'string' && savedTheme in THEMES) await update($, theme, () => savedTheme)
  } catch {
    // Defaults stay.
  }
}

async function loadProject($: EngineInterface) {
  try {
    const rootPath = await $.session.root()
    const pick = (all: unknown) => (all && typeof all === 'object' ? (all as Record<string, unknown>)[rootPath] : null)
    const [allRules, savedTodos, savedNotes, savedChecks] = await Promise.all([
      loadRules($),
      $.store.get('todos'),
      $.store.get('notes'),
      $.store.get('checks'),
      update($, root, () => rootPath),
      update($, project, () => baseName(rootPath)),
    ])
    const list = allRules[rootPath]
    const todoList = pick(savedTodos)
    const noteList = pick(savedNotes)
    const command = pick(savedChecks)
    await Promise.all([
      update($, rules, () => (Array.isArray(list) ? list : [])),
      update($, todos, () => (Array.isArray(todoList) ? (todoList as Todo[]) : [])),
      update($, notes, () =>
        Array.isArray(noteList) ? noteList.filter((x): x is string => typeof x === 'string') : [],
      ),
      update($, checkCommand, () => (typeof command === 'string' ? command : '')),
    ])
  } catch {
    await update($, project, () => '').catch(() => undefined)
  }
}

async function loadHome($: EngineInterface) {
  try {
    const homeDir = (await $.env.get('HOME')) ?? ''
    const [stats] = await Promise.all([loadStats($), update($, home, () => homeDir)])
    // One read of the stats feeds all three.
    await Promise.all([refreshHeat($, stats), refreshSpend($, stats), buildSplash($, stats)])
  } catch {
    // No home: journal, checkpoints and the sessions list stay off.
  }
}

// Side by side: a start or a reload waits for the slowest part, not for all in a row.
const loadState = async ($: EngineInterface) => {
  await loadSettingsAndTheme($)
  await Promise.all([loadProject($), loadHome($)])
}

async function helpText($: EngineInterface) {
  const s = await read($, settings)
  const toggles = (Object.keys(SETTING_INFO) as (keyof Settings)[]).map(
    key => `  ${key.padEnd(12)}${s[key] ? '[bật] ' : '[tắt] '}${SETTING_INFO[key]}`,
  )
  return [
    'Cách dùng: /mods <lệnh>',
    'Bảng:',
    '  sessions  các session Claude đang chạy trên máy (nhắn tin, copy lệnh resume)',
    '  dash      bảng hoạt động: subagent, git, tốc độ, file đã sửa (bấm để xem diff), tool',
    '  prompts   prompt nhanh: bấm để gửi',
    '  save <x>  lưu x thành một prompt nhanh',
    '  settings  tab cài đặt: bật/tắt nhanh mọi tính năng',
    `  theme <x> bảng màu: ${Object.keys(THEMES).join(' | ')}`,
    '  clear     xoá nội dung đang gõ trong ô nhập',
    '  replay    xem lại từng file Claude sửa ở lượt vừa xong, từng diff một',
    '  monitor   AI monitor: agent đang chạy, model, effort, thời gian, context, token, ≈ tiền',
    '  turns     các commit nháp theo lượt (bật /mods shadow)',
    '  changelog [write]  changelog hôm nay từ commit; write ghi vào CHANGELOG.md',
    '  accounts [x] tài khoản Claude (cần claude-swap): thêm, xoá, đổi nhanh; có x thì đổi sang x',
    '  sel       hành động với đoạn đang bôi đen (giải thích, dịch, copy)',
    '  find <x>  tìm x trong hội thoại này',
    'Công cụ:',
    '  budget <$>|off     giới hạn chi tiêu theo ngày',
    '  budget week <$>|off  giới hạn chi tiêu 7 ngày',
    '  history <x>        tìm x trong prompt của mọi session trong dự án này',
    '  pr                 soạn mô tả PR từ commit và file so với main',
    '  pin                ghim câu trả lời gần nhất vào ghi chú',
    '  export             xuất hội thoại ra file Markdown trong thư mục nhà',
    '  quota              mức dùng 5h/7d và giờ reset',
    '  undo [file] · checkpoints   hoàn tác lần sửa file gần nhất của Claude',
    '  check "<lệnh>"|run|off      lệnh kiểm tra của dự án',
    '  commit             Haiku soạn commit message từ phần đã stage',
    '  todo [x] · note [x]         bảng TODO và ghi chú của dự án',
    '  standup            tóm tắt hôm qua/hôm nay, copy sẵn',
    '  handoff <session>  bàn giao việc đang làm cho session khác',
    '  copy [n]           copy khối code thứ n từ cuối',
    '  context            context đang dùng cho những gì',
    '  stats              chi phí, số lượt, thời gian 7 ngày gần nhất',
    '  abbrev [;k nội dung]  xem / thêm / xóa (bỏ nội dung) từ viết tắt',
    '  rule <x> · rules · unrule <số>  luật riêng của dự án này',
    '  timer <phút>       hẹn giờ (không số: hủy)',
    '  vui                một câu đùa và dự báo hài cho hôm nay',
    'Phiên bản:',
    '  version   phiên bản đang dùng và tag mới nhất',
    '  update    cập nhật lên tag mới nhất rồi tự /reload-plugins',
    'Bật/tắt (giữ qua các session):',
    ...toggles,
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    interactive = e.isInteractive
    const ran = await next(e)
    // A reload keeps state but not timers: an effect left set would freeze on the band.
    await update($, fx, () => null).catch(() => undefined)
    // `/mods` first and alone: nothing after it may take the command down.
    try {
      await $.command.register({
        name: 'mods',
        description: 'Giao diện và tiện ích: settings, sessions, dash, prompts, stats, find, timer, update…',
        argumentHint:
          'settings | theme | accounts | clear | replay | monitor | turns | changelog | budget | undo | check | commit | todo | note | standup | handoff | copy [n] | context | sessions | dash | prompts | sel | find <x> | stats | abbrev | rule <x> | timer <phút> | version | update | history <x> | pr | pin | quota',
      })
    } catch {
      void notice($, 'terminal-polish: không đăng ký được /mods')
    }
    // Independent of each other: run side by side, so a start or a reload waits
    // for the slowest one (git), not for all of them in a row.
    const loadClock = async () => {
      await refreshUsage($)
      try {
        const [now, began, use, t] = await Promise.all([
          $.clock.now(),
          read($, startedAt),
          read($, usage),
          read($, timer),
        ])
        // First load of this session (a hot reload keeps startedAt): greet once.
        await Promise.all([
          began === 0 ? update($, splash, () => true) : undefined,
          update($, startedAt, x => x || now),
          update($, lastUsd, () => use?.usd ?? null),
        ])
        if (t && t.endsAt > now) await armTimer($, t.endsAt)
        else if (t) {
          await update($, timer, () => null)
          await notice($, '⏰ Hết giờ! (trong lúc nạp lại)')
        }
      } catch {
        // Stats and the timer start fresh.
      }
    }
    const loadTools = async () => {
      try {
        if (!(await read($, settings)).tools) return
        await Promise.all([
          $.tool.register({
            name: 'notify_me',
            description:
              'Notify the user right away (a desktop notification and a toast) when you need their decision or finished a long task they may not be watching. Use sparingly.',
            inputSchema: {
              type: 'object',
              properties: { message: { type: 'string', description: 'One short sentence for the user' } },
              required: ['message'],
            },
            isDeferred: false,
          }),
          $.agent.register({
            name: 'reviewer',
            description: 'Reviews a diff or files for bugs, security issues and needless complexity; read-only.',
            prompt: REVIEWER_PROMPT,
            tools: ['Read', 'Grep', 'Glob', 'Bash'],
          }),
          $.agent.register({
            name: 'tester',
            description: 'Writes and runs the smallest tests for a change and reports the evidence.',
            prompt: TESTER_PROMPT,
            tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
          }),
        ])
      } catch {
        // The rest of the mod runs without them.
      }
    }
    await Promise.all([loadState($), refreshGit($), loadClock(), loadTools()])
    await pollPanes($)
    $.clock.every(POLL_MS, () => void pollPanes($))
    void autoUpdate($).catch(() => undefined)

    return ran
  })

  // /clear, /resume and /branch put every $.state value back to its default and
  // do not fire session.start: load what the store holds again. No greeting,
  // no second poll timer; the new conversation's clock starts now.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    try {
      await Promise.all([loadState($), refreshGit($), refreshUsage($)])
      const now = await $.clock.now()
      const use = await read($, usage)
      await Promise.all([update($, startedAt, () => now), update($, lastUsd, () => use?.usd ?? null)])
    } catch {
      // Defaults stay until the next start.
    }
    return next(e)
  })

  // From anyone but the person (another plugin's $.command.run), /mods only
  // reads: nothing that changes a setting, the system prompt (rule), prompts
  // (abbrev, save), files (undo, commit), runs a command (check) or sends the
  // conversation elsewhere (handoff).
  const READ_ONLY = new Set([
    '',
    'help',
    'version',
    'stats',
    'sessions',
    'dash',
    'settings',
    'find',
    'context',
    'checkpoints',
    'rules',
    'vui',
    'history',
    'quota',
  ])

  on('command.run', { command: 'mods' }, async ($, e) => {
    const args = e.args.trim()
    const word = args.split(/\s+/)[0] ?? ''
    if (!READ_ONLY.has(word) && e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') {
      return { text: `/mods ${word} chỉ chạy được khi bạn tự gõ.` }
    }
    switch (word) {
      case 'sessions':
        return placed(await openPeers($), 'Đã mở danh sách session.')
      case 'dash':
        return placed(await openDash($), 'Đã mở bảng hoạt động.')
      case 'prompts':
        return placed(await openPrompts($), 'Đã mở prompt nhanh.')
      case 'settings':
        return placed(await openSettings($), 'Đã mở tab cài đặt.')
      case 'budget':
        return { text: await budgetCommand($, args.slice(word.length).trim()) }
      case 'history':
        return { text: await historyCommand($, args.slice(word.length).trim()) }
      case 'pr':
        return { text: await prCommand($) }
      case 'pin':
        return { text: await pinCommand($) }
      case 'export':
        return { text: await exportCommand($) }
      case 'quota':
        return { text: await quotaCommand($) }
      case 'undo':
        return { text: await undoCommand($, args.slice(word.length).trim()) }
      case 'clear': {
        const filled = await $.prompt.fill({ text: '', mode: 'replace' })
        return { text: filled.isFilled ? 'Đã xoá nội dung ô nhập.' : 'Không xoá được ô nhập.' }
      }
      case 'checkpoints':
        return { text: checkpointsText(await read($, checkpoints)) }
      case 'check':
        return { text: await checkCommandText($, args.slice(word.length).trim()) }
      case 'commit':
        await draftCommit($)
        return placed(await openCommit($), 'Đã soạn commit message.')
      case 'todo': {
        const text = args.slice(word.length).trim()
        if (text) await addTodos($, [{ text, done: false }])
        return placed(await openTodo($), text ? `Đã thêm TODO: ${text}` : 'Đã mở bảng TODO.')
      }
      case 'monitor':
        return placed(await openMonitor($), 'Đã mở AI monitor.')
      case 'turns':
        return { text: await turnsCommand($) }
      case 'changelog':
        return { text: await changelogCommand($, args.slice(word.length).trim()) }
      case 'replay': {
        if ((await read($, replay)).length === 0) return { text: 'Chưa có lượt nào sửa file để xem lại.' }
        return placed(await openReplay($), 'Đã mở Replay: n = bước sau, p = bước trước.')
      }
      case 'account':
      case 'accounts': {
        // /profile can't run while this hook holds the turn (the host refuses it): defer past the return.
        const name = args.slice(word.length).trim()
        if (name) {
          if (!PROFILE_NAME.test(name)) return { text: `Tên profile không hợp lệ: ${name}` }
          $.clock.after(500, () =>
            void accountRun($, `swap ${name}`)
              .then(note => notice($, note || `Đã đổi sang ${name}`))
              .catch(() => undefined),
          )
          return { text: `Đang đổi sang ${name}…` }
        }
        const opened = await openAccounts($)
        $.clock.after(500, () => void loadAccounts($).catch(() => undefined))
        return placed(opened, 'Đã mở bảng tài khoản.')
      }
      case 'notes':
      case 'note': {
        const text = args.slice(word.length).trim()
        if (text) await setNotes($, l => [...l, text].slice(-50))
        return placed(await openNotes($), text ? `Đã ghi: ${text}` : 'Đã mở ghi chú.')
      }
      case 'standup': {
        const text = await standupText($)
        const copied = await $.ui.copy({ text })
        return { text: `${text}${copied.isCopied ? '\n📋 Đã copy.' : ''}` }
      }
      case 'handoff':
        return { text: await handoffCommand($, args.slice(word.length).trim()) }
      case 'copy':
        return { text: await copyCommand($, args.slice(word.length).trim()) }
      case 'context':
        await refreshBreakdown($)
        return placed(await openContext($), 'Đã mở phân tích context.')
      case 'theme': {
        const name = args.slice(word.length).trim().toLowerCase()
        if (!(name in THEMES)) {
          return { text: `Theme: ${Object.keys(THEMES).join(' | ')} (đang dùng: ${await read($, theme)})` }
        }
        await setTheme($, name)
        const bg = THEMES[name]?.bg
        return {
          text:
            name === 'auto'
              ? 'Đã đổi theme: auto (theo theme Claude Code)'
              : `Đã đổi theme: ${name}${bg ? `\n💡 Đặt màu nền terminal là ${bg} để khớp hẳn với theme.` : ''}`,
        }
      }
      case 'sel':
        return {
          text: (await grabSelection($))
            ? 'Đã lấy đoạn đang bôi đen.'
            : 'Chưa bôi đen gì: bôi đen một đoạn trong transcript (chế độ fullscreen) rồi thử lại.',
        }
      case 'find':
        return findCommand($, args.slice(word.length).trim())
      case 'stats':
        return { text: await statsText($) }
      case 'abbrev':
        return { text: await abbrevCommand($, args.slice(word.length).trim()) }
      case 'rule': {
        const text = args.slice(word.length).trim()
        if (!text) return { text: 'Cách dùng: /mods rule <nội dung luật>' }
        return { text: rulesText(await setRules($, list => [...list, text])) }
      }
      case 'rules':
        return { text: rulesText(await read($, rules)) }
      case 'unrule': {
        const at = Number.parseInt(args.slice(word.length), 10) - 1
        if (!(at >= 0)) return { text: 'Cách dùng: /mods unrule <số thứ tự>' }
        return { text: rulesText(await setRules($, list => list.filter((_, i) => i !== at))) }
      }
      case 'timer':
        return { text: await timerCommand($, args.slice(word.length).trim()) }
      case 'vui': {
        const now = await $.clock.now()
        return { text: `😄 ${JOKES[Math.floor(Math.random() * JOKES.length)]}\n🔮 ${forecastFor(now)}` }
      }
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
    // A subagent's turn must not reset the main turn's counters or model pick.
    if (e.agentId) return next(e)
    turnSteps = []
    jokeAt = Math.floor(Math.random() * JOKES.length)
    const value: Turn = { tools: 0, failed: 0, edits: 0 }
    const [, , effect, s] = await Promise.all([
      Promise.all([
        update($, turn, () => value),
        update($, liveTurn, () => ({ id: e.turnId, text: e.text })),
        update($, failed, () => null),
      ]),
      Promise.all([update($, autoModel, () => null), update($, autoEffort, () => null)]),
      read($, fx),
      read($, settings),
    ])
    if (s.splashhide) await update($, splash, () => false)
    longTimer?.cancel()
    longTimer = s.notify ? $.clock.after(LONG_TURN_MS, () => void longTurn($)) : null
    if (effect !== 'party') void startFx($, 'comet')
    if (s.automodel && e.text.trim()) {
      try {
        const label = await $.model.classify(
          e.text.slice(0, 4000),
          ['simple: a quick question or a small, local edit', 'complex: multi-step work, debugging, design or review'],
          { model: 'haiku' },
        )
        if (label?.startsWith('simple')) {
          await Promise.all([update($, autoModel, () => 'haiku'), update($, autoEffort, () => 'low' as const)])
        } else if (label?.startsWith('complex')) {
          await update($, autoEffort, () => 'high' as const)
        }
      } catch {
        // Keep the session's own model.
      }
    }
    return next(e)
  })

  // Auto model (20): a turn classified simple runs its main-thread steps on Haiku
  // at low effort, a complex one at high effort; a subagent's steps take the effort
  // its spawn picked. Effort is only set where the model takes one.
  on('turn.step', async function* ($, e, next) {
    let step = e
    if (e.agentId) {
      const effort = agentEfforts.get(e.agentId)
      if (effort && e.effort !== undefined) step = { ...e, effort }
    } else {
      const [pick, effort] = await Promise.all([read($, autoModel), read($, autoEffort)])
      const model = pick === 'haiku' ? haikuIdFor(e.model) : undefined
      if (model) step = { ...e, model }
      else if (effort && e.effort !== undefined) step = { ...e, effort }
    }
    const ran = yield* next(step)
    // The AI monitor only displays: its failure never touches the step.
    if (ran.usage) await recordStep($, step.agentId, step.effort, ran.usage).catch(() => undefined)
    return ran
  })

  // Auto model for subagents: a model Claude left out is picked by the task; a
  // fork or teammate keeps its parent's, a resumed run keeps its own.
  on('agent.spawn', async ($, e, next) => {
    agentsLive = true
    if (e.fork || e.isTeammate || e.resume || !(await read($, settings)).automodel) return next(e)
    // A model Claude chose keeps its own effort: the plan's would not fit it.
    if (e.model !== undefined) return next(e)
    const plan = agentPlan(e.subagentType, e.description)
    const ran = await next({ ...e, model: plan.model })
    if ('agentId' in ran && typeof ran.agentId === 'string') rememberEffort(ran.agentId, plan.effort)
    return ran
  })

  // Abbreviations (15): expand `;key` before the prompt is sent.
  // Before a typed prompt leaves: secrets (39), budget (38), abbreviations (15).
  // A prompt starting with >> goes through both checks, the >> removed.
  on('prompt.submit', async ($, e, next) => {
    const s = await read($, settings)
    const kind = e.origin.kind
    const isTyped = kind === 'composer' || kind === 'bridge'
    const isForced = isTyped && e.text.startsWith(BYPASS)
    let text = isForced ? e.text.slice(BYPASS.length).trimStart() : e.text
    if (!isForced && isTyped && s.secrets) {
      const found = secretIn(text)
      if (found) {
        return {
          drop: `🔐 Prompt có vẻ chứa ${found}, chưa gửi. Xóa nó đi, hoặc gửi lại với "${BYPASS}" ở đầu nếu chắc chắn.`,
        }
      }
    }
    // Every prompt that starts a turn spends: /loop, panes and remote ones too,
    // a background task's notification excepted. Today's spend is re-read here,
    // so a limit hit yesterday does not hold this morning's prompts.
    // The limit is read from the store (another session may have set it); the
    // stats only when there is one.
    if (!isForced && isTyped && s.promptlint) {
      const hint = vagueHint(text)
      if (hint) void notice($, hint).catch(() => undefined)
    }
    const gated = !isForced && s.budget && kind !== 'task-notification'
    const [budget, weekLimit] = gated ? await Promise.all([$.store.get('budget'), $.store.get('budgetweek')]) : [0, 0]
    const dayOn = typeof budget === 'number' && budget > 0
    const weekOn = typeof weekLimit === 'number' && weekLimit > 0
    const stats = dayOn || weekOn ? await loadStats($) : undefined
    if (dayOn) {
      await refreshSpend($, stats)
      const [limit, spent] = await Promise.all([read($, budgetLimit), read($, spentToday)])
      if (limit > 0 && spent >= limit) {
        return {
          drop: `💰 Đã dùng $${spent.toFixed(2)} / $${limit.toFixed(2)} hôm nay. Gửi lại với "${BYPASS}" ở đầu để vẫn gửi, hoặc /mods budget off.`,
        }
      }
    }
    if (weekOn && stats && typeof weekLimit === 'number') {
      const week = spendSince(stats, last7Days(await $.clock.now()))
      if (week >= weekLimit) {
        return { drop: `💰 7 ngày qua đã dùng $${week.toFixed(2)} / $${weekLimit.toFixed(2)}. Gửi lại với "${BYPASS}" ở đầu để vẫn gửi, hoặc /mods budget week off.` }
      }
    }
    if (s.abbrev && kind === 'composer' && text.includes(';')) text = expandAbbrevs(text, await loadAbbrevs($))
    return next(text === e.text ? e : { ...e, text })
  }).catch(($, e, next) => {
    // A fault holds a typed prompt back (>> still sends it) rather than skip the checks.
    if (next.called) return next(e)
    const isTyped = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (!isTyped) return next(e)
    if (e.text.startsWith(BYPASS)) return next({ ...e, text: e.text.slice(BYPASS.length).trimStart() })
    return { drop: `terminal-polish: không kiểm tra được prompt nên đã giữ lại. Gửi lại với "${BYPASS}" ở đầu để gửi.` }
  })

  // Compact (45): tell the summary what it must keep.
  on('session.compact', async ($, e, next) => {
    if (e.agentId || !(await read($, settings)).compactplus) return next(e)
    const extra = await compactNotes($)
    return next({ ...e, instructions: [e.instructions, extra].filter(Boolean).join('\n\n') })
  })

  // Project rules (17): appended to the system prompt, last.
  on('prompt.compose', async ($, e, next) => {
    const [ran, list, s] = await Promise.all([next(e), read($, rules), read($, settings)])
    const extra = [
      ...(s.rules && list.length > 0
        ? [
            {
              id: 'terminal-polish-rules',
              scope: 'session' as const,
              text: ['Project rules the user set for this repository (follow them):', ...list.map(r => `- ${r}`)].join(
                '\n',
              ),
            },
          ]
        : []),
      ...(s.automodel ? [{ id: 'terminal-polish-automodel', scope: 'session' as const, text: AUTO_MODEL_RULES }] : []),
    ]
    return extra.length > 0 ? { ...ran, sections: [...ran.sections, ...extra] } : ran
  })

  // notify_me (18): a tool the model calls to reach the user.
  on('tool.call', { tool: NOTIFY_TOOL }, async ($, e) => {
    if (!(await read($, settings)).tools) {
      return { deny: 'The user turned notify_me off.' }
    }
    const raw = (e as unknown as { message?: unknown }).message
    const message = (typeof raw === 'string' ? raw : '').trim().slice(0, 300) || 'Claude cần bạn.'
    void notice($, `🔔 ${message}`)
    const title = (await read($, project)) || 'Claude'
    const sent = await $.ui.notify(message, { title }).catch(() => undefined)
    // An MCP tool's result is its content: a string (or content blocks), never an object.
    return {
      result:
        sent?.isSent === true
          ? 'Notified the user.'
          : 'Shown in the session as a toast; no desktop notification channel.',
    }
  })

  on('session.end', async ($, e, next) => {
    try {
      if ((await read($, settings)).journal) await writeJournal($)
    } catch {
      // Exits stay fast; a lost entry is the cost.
    }
    try {
      // Checkpoints live only as long as the session that can undo them.
      const dir = await read($, home)
      const id = await $.session.id()
      if (dir && /^[\w-]+$/.test(id)) {
        await $.process.run(['rm', '-rf', '--', `${dir}/.claude/mods-checkpoints/${id}`], { timeoutMs: 3000 })
      }
    } catch {
      // Left for the next cleanup.
    }
    return next(e)
  })

  // Guard: a risky shell command or a secret file is put to the person. A
  // tool.check ask with decider "person" lets only the permission dialog approve
  // it; where nobody can be asked, it is refused with this reason. A fault denies.
  const personAsk = (reason: string) => ({
    decision: 'ask' as const,
    reason: `terminal-polish cần bạn duyệt: ${reason}. Chỉ hộp thoại quyền mới cho chạy; không có ai để hỏi thì bị chặn.`,
    // The SDK types in this repo predate CLI 2.1.304, which added 'person'.
    decider: 'person' as unknown as 'host',
  })
  const checkFailed = { decision: 'deny' as const, reason: 'terminal-polish: bộ chặn lỗi, đã chặn cho an toàn.' }
  const guardFailed = { deny: 'terminal-polish: bộ chặn lỗi, đã chặn cho an toàn.' }
  const textOf = (input: unknown, key: string) => {
    const v = (input as Record<string, unknown> | null)?.[key]
    return typeof v === 'string' ? v : ''
  }

  // A core deny stands: a hook only tightens it to an ask, never loosens it.
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.decision === 'deny') return ran
    const reason = await shellReason($, textOf(e.input, 'command'))
    if (!reason) return ran
    if (e.tool_use_id) void notice($, `🛡 Cần duyệt: ${reason}`)
    return personAsk(reason)
  }).catch(() => checkFailed)

  // Monitor runs a shell command too: the same rules, or it is a way around them.
  on('tool.check', { tool: 'Monitor' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.decision === 'deny') return ran
    const reason = await shellReason($, textOf(e.input, 'command'))
    if (!reason) return ran
    if (e.tool_use_id) void notice($, `🛡 Cần duyệt: ${reason}`)
    return personAsk(reason)
  }).catch(() => checkFailed)

  on('tool.check', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    const file = textOf(e.input, 'file_path')
    if (ran.decision === 'deny' || !isSecretFile(file) || !(await read($, settings)).guard) return ran
    if (e.tool_use_id) void notice($, `🛡 Cần duyệt sửa ${baseName(file)}`)
    return personAsk(`sửa file bí mật ${baseName(file)}`)
  }).catch(() => checkFailed)

  on('tool.check', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    const file = textOf(e.input, 'file_path')
    if (ran.decision === 'deny' || !isSecretFile(file) || !(await read($, settings)).guard) return ran
    if (e.tool_use_id) void notice($, `🛡 Cần duyệt ghi ${baseName(file)}`)
    return personAsk(`ghi file bí mật ${baseName(file)}`)
  }).catch(() => checkFailed)

  // The held-command card (blast) stays on the call itself: it waits for the person's answer.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const held = await heldVerdict($, e.tool_use_id, e.command, next.signal, e.agentId)
    return held ?? next(e)
  }).catch(($, e, next) => (next.called ? next(e) : guardFailed))

  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const command = textOf(e, 'command')
    // The same hold as Bash, or Monitor is a way around it.
    const held = await heldVerdict($, e.tool_use_id, command, next.signal, e.agentId)
    return held ?? next(e)
  }).catch(($, e, next) => (next.called ? next(e) : guardFailed))

  // Bookkeeping: fails open. Every step around `next` is caught, so a fault
  // here can neither block a tool nor knock the guard out of the chain.
  on('tool.call', async ($, e, next) => {
    const path = e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'Read' ? e.file_path : undefined
    const label = e.tool === 'Bash' ? commandLabel(e.command) : path ? baseName(path) : ''
    const call: Call = { id: e.tool_use_id, tool: e.tool, label, state: 'run' }
    let began = 0
    let pointId: number | undefined
    let writeBefore = ''
    try {
      const [now, , , s] = await Promise.all([
        $.clock.now(),
        update($, calls, list => [...list, call].slice(-100)),
        update($, turn, t => (t ? { ...t, tools: t.tools + 1 } : t)),
        read($, settings),
      ])
      began = now
      if (e.tool === 'AskUserQuestion' && s.asknotify && !(s.quiet && inQuiet(new Date(now).getHours())))
        void $.ui.notify('Claude đang chờ bạn trả lời').catch(() => undefined)
      if (path && e.tool !== 'Read' && s.checkpoints) pointId = await snapshot($, path)
      if (e.tool === 'Write') writeBefore = await $.fs.read(e.file_path).catch(() => '')
    } catch {
      // The row is only display.
    }

    const ran = await next(e)

    try {
      const elapsed = began ? (await $.clock.now()) - began : undefined
      const isFailed = ran.deny !== undefined || ran.isError === true
      // A denied or failed edit changed nothing: its checkpoint would undo nothing.
      if (isFailed && pointId !== undefined) await update($, checkpoints, l => l.filter(c => c.id !== pointId))
      const isEdit = !isFailed && !!path && e.tool !== 'Read'
      const [, , , s] = await Promise.all([
        update($, calls, list =>
          list.map(one =>
            one.id === call.id ? { ...one, state: isFailed ? ('fail' as const) : ('ok' as const), ms: elapsed } : one,
          ),
        ),
        isFailed || isEdit
          ? update($, turn, t => (t ? { ...t, failed: t.failed + (isFailed ? 1 : 0), edits: t.edits + (isEdit ? 1 : 0) } : t))
          : undefined,
        isEdit && path ? update($, files, list => [path, ...list.filter(f => f !== path)].slice(0, 30)) : undefined,
        read($, settings),
      ])
      if (e.tool === 'Bash' && ran.deny === undefined && TEST_COMMAND.test(e.command)) {
        const name = isFailed ? (failName(outputOf(ran.result)) ?? 'test lỗi') : null
        if (name !== lastFail) {
          lastFail = name
          await update($, testFail, () => name)
        }
      }
      if (s.confetti && !isFailed && e.tool === 'Bash' && TEST_COMMAND.test(e.command) && !/\|/.test(e.command)) {
        void notice($, '🎉 Test pass!')
        void startFx($, 'party')
      }
      if (isEdit && path) {
        if (turnSteps.length < MAX_STEPS) {
          if (e.tool === 'Edit') turnSteps.push({ path, tool: e.tool, ...editDiff(e.old_string, e.new_string) })
          if (e.tool === 'Write') turnSteps.push({ path, tool: e.tool, ...editDiff(writeBefore, e.content) })
        }
        if (s.format) await formatFile($, path)
        if (s.relatedtest) void relatedTests($, path)
        if (s.todos) {
          const written = e.tool === 'Edit' ? e.new_string : e.tool === 'Write' ? e.content : ''
          await addTodos($, todosIn(written, path))
        }
      }
    } catch {
      // The row is only display.
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    if (turnSteps.length > 0) {
      const steps = turnSteps
      turnSteps = []
      await Promise.all([
        update($, replay, () => steps),
        update($, replayCount, () => steps.length),
        update($, replayAt, () => 0),
      ]).catch(() => undefined)
      if ((await read($, settings)).shadow) {
        const prompt = (await read($, liveTurn))?.text.split('\n')[0]?.slice(0, 72) || 'turn'
        void queueShadow($, `turn: ${prompt} (${steps.length} edit)`)
      }
    }
    const ran = await next(e)
    const [s, t, live] = await Promise.all([read($, settings), read($, turn), read($, liveTurn)])
    longTimer?.cancel()
    longTimer = null
    // Asked first, so Haiku answers while the bookkeeping below runs, not after it.
    const tldr =
      s.tldr && e.reason === 'answer' && !e.isAborted && e.answer.length >= TLDR_MIN_CHARS
        ? $.model
            .complete({
              model: 'haiku',
              maxTokens: 200,
              timeoutMs: 8000,
              system:
                'Tóm tắt câu trả lời sau trong tối đa hai câu ngắn, cùng ngôn ngữ với nó. Chỉ viết phần tóm tắt, không mở đầu.',
              prompt: e.answer.slice(0, 20000),
            })
            .catch(() => undefined)
        : undefined
    const done: LastTurn = { seconds: Math.round(e.durationMs / 1000), tools: t?.tools ?? 0, failed: t?.failed ?? 0 }
    try {
      if (s.todos && e.reason === 'answer') await addTodos($, todosIn(e.answer))
      if (s.autocheck && (t?.edits ?? 0) > 0) void runCheck($)
    } catch {
      // Extras never hold the turn up.
    }
    try {
      await Promise.all([
        e.reason === 'error' && live ? update($, failed, () => ({ text: live.text })) : undefined,
        update($, last, () => done),
        update($, history, list => [...list, done].slice(-20)),
        Promise.all([update($, turn, () => null), update($, liveTurn, () => null)]),
        Promise.all([update($, autoModel, () => null), update($, autoEffort, () => null)]),
      ])
      if (e.reason === 'answer' && !e.isAborted) await update($, lastAnswer, () => e.answer)
      await endFx($, 'comet')
    } catch {
      // The rest (stats, git, TL;DR) still runs.
    }
    if (done.seconds >= TOAST_SECONDS && done.failed === 0 && !e.isAborted) void startFx($, 'party')
    await update($, totals, x => ({
      turns: x.turns + 1,
      seconds: x.seconds + done.seconds,
      tools: x.tools + done.tools,
    }))

    const summary = `Xong sau ${duration(e.durationMs)} · ${done.tools} tool${done.failed ? ` · ${done.failed} lỗi` : ''}`
    if (s.notify && done.seconds >= TOAST_SECONDS) void notice($, `✓ ${summary}`)
    if (done.seconds >= NOTIFY_SECONDS && !e.isAborted) {
      const title = (await read($, project)) || 'Claude'
      const muted = s.quiet && inQuiet(new Date(await $.clock.now()).getHours())
      if (s.notify && !muted) void $.ui.notify(summary, { title }).catch(() => undefined)
      if (s.sound && !muted) void $.audio.play({ asset: 'sounds/done.wav' }).catch(() => undefined)
      if (s.voice && !muted) void $.audio.speak('Claude đã xong').catch(() => undefined)
    }
    await Promise.all([refreshGit($), refreshUsage($, true)])
    if (s.quotaalert) {
      const alert = quotaAlert((await read($, usage))?.limits ?? [], await read($, quotaWarned), await $.clock.now())
      if (alert) {
        await update($, quotaWarned, () => alert.keys)
        void notice($, `⚠ ${alert.text}`)
      }
    }
    try {
      const use = await read($, usage)
      const before = await read($, lastUsd)
      const spent = use?.usd != null && before != null ? Math.max(0, use.usd - before) : 0
      await update($, lastUsd, () => use?.usd ?? before)
      const stats = await recordStats($, (await read($, project)) || 'claude', done, spent)
      await Promise.all([refreshHeat($, stats), refreshSpend($, stats)])
      const limit = await read($, budgetLimit)
      const spentNow = await read($, spentToday)
      const day = localDay(await $.clock.now())
      if (s.budget && limit > 0 && spentNow >= limit * 0.8 && (await read($, budgetWarned)) !== day) {
        await update($, budgetWarned, () => day)
        void notice(
          $,
          `💰 Đã dùng ${Math.round((spentNow / limit) * 100)}% ngân sách hôm nay ($${spentNow.toFixed(2)} / $${limit.toFixed(2)})`,
        )
      }

      // Auto-compact (13): once per crossing; compacting runs after this turn has closed.
      const pct = use?.percent ?? 0
      if (pct < COMPACT_PERCENT) {
        await update($, ctxWarned, () => false)
      } else if (!(await read($, ctxWarned))) {
        await update($, ctxWarned, () => true)
        if (s.autocompact) {
          void notice($, `Context ${pct}%: đang tự /compact…`)
          $.clock.after(500, () => void $.session.compact({}).catch(() => undefined))
        } else if (s.ctxwarn) {
          void notice($, `Context ${pct}%: nên /compact (hoặc /mods autocompact để tự làm)`)
        }
      }
    } catch {
      // Stats are best effort.
    }

    const reply = await tldr
    return reply?.isAnswered && reply.text.trim() ? { ...ran, text: `TL;DR: ${reply.text.trim()}` } : ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [[P, s], held] = await Promise.all([look($), read($, blast)])
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    // A held command: drawn even with the band off, it is the only place to answer.
    // Digits answer from an empty prompt; Cancel holds the focus, so Enter cancels.
    const hold = held ? (
      <Box key="blast" flexDirection="column" borderStyle="round" borderColor={P.warn} paddingX={1} marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={P.warn} bold>
            ⚠ Đang giữ lệnh:
          </Text>
          <Text wrap="wrap">{held.command}</Text>
        </Box>
        <Text color={P.err} bold wrap="wrap">
          {held.title}
        </Text>
        {held.lines.map(line => (
          <Text color={P.muted} wrap="truncate-middle">{`  ${line}`}</Text>
        ))}
        {held.note ? <Text color={P.muted}>{`  ${held.note}`}</Text> : null}
        <Box flexDirection="row" gap={2} marginTop={1}>
          <Button key="blast-run" label="Chạy" hotkey="1" plain onPress={() => void answerBlast($, held.id, 'run')} />
          <Button
            key="blast-cancel"
            label="Hủy"
            hotkey="2"
            plain
            autoFocus
            onPress={() => void answerBlast($, held.id, 'cancel')}
          />
        </Box>
      </Box>
    ) : null
    if (e.props.hasSurvey || !s.band) {
      // Nothing of ours is drawn: the effect timer has nowhere to paint.
      bandSite = null
      if (!hold) return next(e)
      return (
        <Box flexDirection="column" width={e.props.bodyColumns}>
          {hold}
          {await next(e)}
        </Box>
      )
    }
    const Raster = 'Raster' in t ? t.Raster : undefined
    const Image = 'Image' in t ? t.Image : undefined
    const Svg = 'Svg' in t ? t.Svg : undefined
    // One round trip for everything the band draws, not one per value.
    const [
      projectName,
      repo,
      now,
      prev,
      use,
      countdown,
      pick,
      effect,
      isSplash,
      splashText,
      limit,
      spent,
      checked,
      todoList,
      cards,
      subs,
      failing,
      effortPick,
      acc,
      stepCount,
    ] = await Promise.all([
      read($, project),
      read($, git),
      read($, turn),
      read($, last),
      read($, usage),
      read($, timer),
      read($, autoModel),
      read($, fx),
      read($, splash),
      read($, splashInfo),
      read($, budgetLimit),
      read($, spentToday),
      read($, check),
      read($, todos),
      s.notices ? read($, notices) : [],
      read($, agents),
      read($, testFail),
      read($, autoEffort),
      read($, accounts),
      read($, replayCount),
    ])
    const name = projectName || 'claude'
    const pct = use?.percent ?? null
    const limits: Limit[] = s.quota ? (use?.limits ?? []) : []
    const hello = s.splash && isSplash ? splashText : null
    const width = e.props.bodyColumns - (s.statecolor ? 4 : 0)
    bandSite = e.requestId
    fxWidth = Math.max(1, Math.min(width, 80))

    const working = e.props.isWorking && now
    const stateColor = working ? P.warn : prev && prev.failed > 0 ? P.err : P.ok

    // Segments: [text, role color]; drawn plain or as powerline blocks.
    type Segment = { text: string; color: string; meter?: { pct: number }; right?: true; after?: string }
    const segments: Segment[] = []
    if (repo)
      segments.push({ text: `⎇ ${repo.branch}${repo.changed > 0 ? ` ±${repo.changed}` : ' ✓'}`, color: P.violet })
    segments.push(
      working
        ? { text: `● đang chạy · ${now.tools} tool${now.failed > 0 ? ` · ${now.failed} lỗi` : ''}`, color: P.warn }
        : prev
          ? {
              text: `${prev.failed > 0 ? '✗' : '✓'} ${prev.seconds}s · ${prev.tools} tool${prev.failed > 0 ? ` · ${prev.failed} lỗi` : ''}`,
              color: prev.failed > 0 ? P.err : P.ok,
            }
          : { text: 'sẵn sàng', color: P.ok },
    )
    // Token weather: how full the context is, at a glance, and what the last turn added.
    if (pct !== null)
      segments.push(
        s.weather
          ? { text: `${weatherOf(pct)} ctx`, color: P.info, meter: { pct }, after: kTokens(use?.added) }
          : { text: 'ctx', color: P.info, meter: { pct } },
      )
    for (const l of limits)
      segments.push({ text: LIMIT_LABEL[l.kind] ?? l.kind, color: P.cyan, meter: { pct: l.percent } })
    if (use?.usd != null) segments.push({ text: `$${use.usd.toFixed(2)}`, color: P.pink, right: true })
    if (s.budget && limit > 0) {
      segments.push({
        text: `💰 $${spent.toFixed(2)}/$${limit.toFixed(0)}`,
        color: P.pink,
        meter: { pct: Math.round((spent / limit) * 100) },
      })
    }
    if (checked) segments.push({ text: `${checked.ok ? '✓' : '✗'} check`, color: checked.ok ? P.ok : P.err })
    const openTodos = todoList.filter(x => !x.done).length
    if (s.todos && openTodos > 0) segments.push({ text: `☐ ${openTodos}`, color: P.violet })
    if (countdown) segments.push({ text: `⏱ ${countdown.left}m`, color: P.warn })
    if (working && (pick || effortPick)) segments.push({ text: `⚡${pick ?? effortPick}`, color: P.info })
    if (s.testfail && failing) segments.push({ text: `✗ ${failing}`, color: P.err })
    const crew = agentSummary(subs)
    if (crew.running > 0) segments.push({ text: `🤖 ${crew.running} chạy · ${crew.done}/${crew.total} xong`, color: P.info })

    const label = (seg: Segment) =>
      seg.meter ? (s.meters ? `${seg.text} ` : `${seg.text} ${seg.meter.pct}%`) : seg.text
    const meterRuns = (seg: Segment) =>
      seg.meter && s.meters
        ? [
            ...meterCells(seg.meter.pct, 6, P).map(c => <Text color={c.color}>{c.ch}</Text>),
            <Text color={seg.color}>{` ${seg.meter.pct}%`}</Text>,
          ]
        : []

    const title = s.gradient ? (
      gradientRuns(`◆ ${name}`, P.grad).map(r => (
        <Text color={r.color} bold>
          {r.ch}
        </Text>
      ))
    ) : (
      <Text color={P.accent} bold>
        ◆ {name}
      </Text>
    )

    const gauges = segments
      .filter(seg => seg.meter)
      .map(seg => (
        <Box flexDirection="row">
          <Text color={P.muted}>{label(seg)}</Text>
          {meterRuns(seg)}
          {seg.after ? <Text color={P.muted}>{` ${seg.after}`}</Text> : null}
        </Box>
      ))

    // Powerline: each segment a colored block, joined by  in the next block's color.
    const POWER = ''
    // A key row, survey style (`s: Session`), dim until pointed at.
    const keys: [string, string, string, () => unknown][] = [
      ...(stepCount > 0
        ? [['replay', `▶ Replay ${stepCount} `, 'r', () => void openReplay($).catch(() => undefined)] as [string, string, string, () => unknown]]
        : []),
      ['sessions', 'Session', 's', () => void openPeers($)],
      ['dash', 'Bảng', 'd', () => void openDash($)],
      ['prompts', 'Prompt', 'p', () => void openPrompts($)],
      ['settings', 'Cài đặt', 'c', () => void openSettings($)],
      ['sel', 'Chọn', 'v', () => void grabSelection($)],
      [
        'accounts',
        `👤 ${acc?.list.find(a => a.active)?.name ?? 'Account'} `,
        'a',
        () => void openAccounts($).then(() => loadAccounts($)).catch(() => undefined),
      ],
      ['monitor', '🤖 Monitor ', 'g', () => void openMonitor($).catch(() => undefined)],
      ['clear', '🧹 Clear ', 'x', () => void $.prompt.fill({ text: '', mode: 'replace' })],
      ['hide', 'Ẩn', 'h', () => void setSetting($, 'band', false)],
    ]
    const buttons = (
      <Box flexDirection="row" flexWrap="wrap">
        {keys.map(([key, text, hotkey, onPress], i) => (
          <Box flexDirection="row">
            {i > 0 ? <Text color={P.muted}>{' · '}</Text> : null}
            <Button key={key} label={text} hotkey={hotkey} plain dimColor onPress={onPress} />
          </Box>
        ))}
      </Box>
    )
    // The key row sits at the right of the header, saving a line; only powerline keeps it below.
    const sideKeys = !s.powerline

    const status = s.powerline ? (
      <Box flexDirection="row" flexWrap="wrap">
        <Text backgroundColor={P.accent} color={P.ink} bold>{` ◆ ${name} `}</Text>
        {segments.map((seg, i) => [
          <Text color={i === 0 ? P.accent : (segments[i - 1]?.color ?? P.accent)} backgroundColor={seg.color}>
            {POWER}
          </Text>,
          <Text
            backgroundColor={seg.color}
            color={P.ink}
          >{` ${label(seg)}${seg.meter && s.meters ? `${seg.meter.pct}%` : ''} `}</Text>,
        ])}
        <Text color={segments[segments.length - 1]?.color ?? P.accent}>{POWER}</Text>
      </Box>
    ) : (
      // Who and what (cost at the right edge), then the gauges: on a second line,
      // or in the same one with `compact`. Each chip is its own Box, so a narrow
      // terminal wraps between chips, never inside one.
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" columnGap={2}>
          <Box flexDirection="row" flexWrap="wrap" flexShrink={1} columnGap={s.compact ? 2 : 3}>
            <Box flexDirection="row">{title}</Box>
            {segments
              .filter(seg => !seg.meter && !seg.right)
              .map(seg => (
                <Text color={seg.color}>{seg.text}</Text>
              ))}
            {s.compact ? gauges : null}
          </Box>
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            {segments
              .filter(seg => seg.right)
              .map(seg => (
                <Text color={seg.color} bold>
                  {seg.text}
                </Text>
              ))}
            {sideKeys ? buttons : null}
          </Box>
        </Box>
        {!s.compact && gauges.length > 0 && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
            {gauges}
          </Box>
        )}
      </Box>
    )

    const welcome = hello && (
      <Box flexDirection="row" gap={2} marginBottom={1}>
        {s.images && Image ? (
          <Image
            key="logo"
            source={{ file: `${$.plugin.root}/assets/logo.png`, format: 'png' }}
            columns={8}
            rows={4}
            alt="◆"
          />
        ) : null}
        <Box flexDirection="column">
          {LOGO.map(line => (
            <Box flexDirection="row">
              {gradientRuns(line, P.grad).map(r => (
                <Text color={r.color} bold>
                  {r.ch}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
        <Box flexDirection="column" flexShrink={1}>
          <Text color={P.accent} bold>
            {hello.greeting}
          </Text>
          <Text color={P.muted} wrap="wrap">
            {hello.last}
          </Text>
          <Text color={P.info} wrap="wrap">
            {hello.tip}
          </Text>
          {s.fun && hello.forecast ? (
            <Text color={P.violet} wrap="wrap">
              {hello.forecast}
            </Text>
          ) : null}
        </Box>
      </Box>
    )

    const scene = s.anim && Svg ? sceneSvg(P) : null
    const strip =
      effect && Raster ? (
        <Raster key="fx" columns={fxWidth} rows={1} cells={fxFrame(effect, fxTick, fxWidth, P)} />
      ) : scene && Svg ? (
        <Svg key="scene" source={scene} alt={`theme ${P.scene}`} height={SCENE_H} isInteractive />
      ) : null

    return (
      <Box
        flexDirection="column"
        width={e.props.bodyColumns}
        {...(s.statecolor ? { borderStyle: 'round', borderColor: stateColor, paddingX: 1 } : {})}
      >
        {hold}
        {/* Notices: one line each behind a rounded mark in their color, not a boxed card. */}
        {cards.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {cards.map(n => (
              <Box key={`notice-${n.id}`} flexDirection="row" gap={1}>
                <Text color={P[n.kind]}>╰</Text>
                <Text>{n.icon}</Text>
                <Text color={P[n.kind]} bold wrap="wrap">
                  {n.text}
                </Text>
              </Box>
            ))}
          </Box>
        )}
        {welcome}
        {status}
        {!sideKeys && buttons}
        {strip}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: DASH }, async ($, e) => {
    const [P, s] = await look($)
    const { Box, Text, Button } = $.ui.resolve(e)
    const [list, touched, repo, subs, turns, counts, opened, now] = await Promise.all([
      read($, calls),
      read($, files),
      read($, git),
      read($, agents),
      read($, history),
      read($, heat),
      read($, openCalls),
      $.clock.now(),
    ])
    const slowest = Math.max(1, ...turns.map(x => x.seconds))
    const crew = agentSummary(subs)
    const shownSubs = subs.slice(-10)
    const busy = list.filter(c => c.state === 'run')
    const room = Math.max(
      3,
      (e.viewport?.rows ?? 24) - 24 - Math.min(touched.length, 8) - shownSubs.length - Math.min(busy.length, 6),
    )
    const HEAT = [P.muted, ...[0.15, 0.5, 0.8, 1].map(t => colorAt(P.grad, t))]

    const heading = (text: string) =>
      s.gradient ? (
        <Box flexDirection="row">
          {gradientRuns(text, P.grad).map(r => (
            <Text color={r.color} bold>
              {r.ch}
            </Text>
          ))}
        </Box>
      ) : (
        <Text color={P.accent} bold>
          {text}
        </Text>
      )

    // A hover card (36): hidden until its keyed row is hovered.
    return (
      <Box flexDirection="column" width={e.props.bodyColumns} gap={1}>
        {subs.length > 0 && (
          <Box flexDirection="column">
            {heading(
              `Agent · ${crew.running} đang chạy · ${crew.done} xong${crew.failed ? ` · ${crew.failed} lỗi` : ''} / ${crew.total}`,
            )}
            {shownSubs.map(a => (
              <Text
                color={
                  a.status === 'running' ? P.warn : a.status === 'failed' || a.status === 'killed' ? P.err : P.muted
                }
                wrap="truncate-end"
              >
                {a.parentId ? '  ↳ ' : ''}
                {a.status === 'running' ? '● ' : a.status === 'completed' ? '✓ ' : '○ '}
                {a.type} · {a.label} · {AGENT_STATUS[a.status] ?? a.status}
              </Text>
            ))}
            {subs.length > shownSubs.length ? (
              <Text color={P.muted}>{`  … ${subs.length - shownSubs.length} agent cũ hơn`}</Text>
            ) : null}
          </Box>
        )}
        {busy.length > 0 && (
          <Box flexDirection="column">
            {heading(`Tiến trình đang chạy (${busy.length})`)}
            {busy.slice(-6).map(c => (
              <Text color={P.warn} wrap="truncate-end">{`◌ ${c.tool}${c.label ? ` · ${shortLabel(c.label)}` : ''}`}</Text>
            ))}
          </Box>
        )}
        <Box flexDirection="column">
          {heading('Git')}
          <Text color={repo ? P.violet : P.muted} wrap="truncate-end">
            {repo ? `⎇ ${repo.branch} · ${repo.changed} file thay đổi` : 'không phải git repo'}
          </Text>
        </Box>
        {turns.length > 0 && (
          <Box flexDirection="column">
            {heading(`Tốc độ ${turns.length} lượt gần đây`)}
            <Box flexDirection="row">
              {turns.map((t, i) => (
                <Text color={t.failed > 0 ? P.err : colorAt(P.grad, i / Math.max(1, turns.length - 1))}>
                  {BARS[Math.min(7, Math.floor((t.seconds / slowest) * 7))] ?? ''}
                </Text>
              ))}
              <Text color={P.muted}> max {Math.max(...turns.map(t => t.seconds))}s</Text>
            </Box>
          </Box>
        )}
        {s.heatmap ? (
          <Box flexDirection="column">
            {heading(`Hoạt động ${HEAT_WEEKS} tuần`)}
            {heatGrid(counts, now).map((row, weekday) => (
              <Box flexDirection="row">
                <Text color={P.muted}>{`${WEEKDAYS[weekday] ?? ''} `}</Text>
                {row.map(level => (
                  <Text color={level === null ? P.muted : (HEAT[level] ?? P.muted)}>
                    {level === null ? '  ' : level === 0 ? '· ' : '■ '}
                  </Text>
                ))}
              </Box>
            ))}
          </Box>
        ) : null}
        <Box flexDirection="column">
          {heading(`File đã sửa (${touched.length}) · bấm để xem diff`)}
          {touched.length === 0 && <Text color={P.muted}>chưa có</Text>}
          {touched.slice(0, 8).map(f => {
            const [tag, tagColor] = fileTag(f)
            return (
              <Box key={`file-${f}`} flexDirection="row" gap={1}>
                {s.fileicons ? (
                  <Text color={tagColor} bold>
                    {tag.padEnd(4)}
                  </Text>
                ) : null}
                <Button key={`diff-${f}`} label={baseName(f)} plain onPress={() => void showDiff($, f)} />
              </Box>
            )
          })}
        </Box>
        <Box flexDirection="column">
          {heading(`Tool gần đây (${list.length})`)}
          {list.length === 0 && <Text color={P.muted}>chưa có</Text>}
          {list
            .slice(-room)
            .reverse()
            .map(call => {
              const isOpen = opened.includes(call.id)
              const short = shortLabel(call.label)
              const status = call.state === 'run' ? 'đang chạy' : call.state === 'ok' ? 'xong' : 'lỗi'
              return (
                <Box key={`call-${call.id}`} flexDirection="column">
                  <Box flexDirection="row" gap={1}>
                    <Text
                      color={P[STATE_ROLE[call.state]]}
                      bold={call.state === 'run'}
                      wrap="truncate-end"
                      hover={s.hovercards ? { inverse: true } : undefined}
                    >
                      {`${ICON[call.state]} ${call.tool.padEnd(5)} ${short.head}`}
                    </Text>
                    {/* Its own element, never shrunk: a narrow pane cuts the label, not this. */}
                    {short.marker ? (
                      <Box flexShrink={0}>
                        <Text color={P.warn}>{short.marker}</Text>
                      </Box>
                    ) : null}
                    {call.ms != null ? (
                      <Box flexShrink={0}>
                        <Text color={P.muted}>{`${(call.ms / 1000).toFixed(1)}s`}</Text>
                      </Box>
                    ) : null}
                    {
                      <Button
                        key={`call-open-${call.id}`}
                        label={isOpen ? '▾' : '▸'}
                        plain
                        dimColor
                        onPress={() =>
                          void update($, openCalls, l =>
                            l.includes(call.id) ? l.filter(x => x !== call.id) : [...l, call.id].slice(-50),
                          )
                        }
                      />
                    }
                  </Box>
                  {isOpen && (
                    <Box
                      flexDirection="column"
                      paddingLeft={2}
                      borderStyle="round"
                      borderColor={P[STATE_ROLE[call.state]]}
                    >
                      <Text color={P[STATE_ROLE[call.state]]} bold>
                        {`${call.tool} · ${status}${call.ms != null ? ` · ${(call.ms / 1000).toFixed(1)}s` : ''}`}
                      </Text>
                      <Text wrap="wrap">{call.label || '(không có tham số)'}</Text>
                    </Box>
                  )}
                </Box>
              )
            })}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: DIFF_PANE }, async ($, e) => {
    const P = await palette($)
    const { Box, Text, Code } = $.ui.resolve(e)
    const shown = await read($, diff)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        {!shown && <Text color={P.muted}>Chọn một file trong /mods dash để xem diff.</Text>}
        {shown && (
          <Text color={P.muted} wrap="truncate-start">
            {shown.path}
          </Text>
        )}
        {shown?.note && <Text color={P.warn}>{shown.note}</Text>}
        {shown?.text && <Code source={shown.text} format="diff" path={shown.path} />}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PEERS_PANE }, async ($, e) => {
    const P = await palette($)
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const list = await read($, peers)
    const busy = list.filter(p => p.status === 'busy').length

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color={P.muted}>
          {list.length} session · {busy} đang chạy · ctrl+x tab để gõ
        </Text>
        {list.length === 0 && <Text color={P.muted}>không tìm thấy session nào</Text>}
        {Input && list.some(p => !p.isSelf && p.status !== 'busy') ? (
          <Input
            key="send-all"
            placeholder="Gửi cho mọi session đang rảnh…"
            submitLabel={`Gửi ${list.filter(p => !p.isSelf && p.status !== 'busy').length} session`}
            onSubmit={text => {
              if (!text.trim()) return
              const idle = list.filter(p => !p.isSelf && p.status !== 'busy')
              void Promise.all(idle.map(p => $.session.send({ to: { sessionId: p.id }, text }).catch(() => null)))
                .then(rs => notice($, `✓ Đã gửi tới ${rs.filter(r => r?.isDelivered).length}/${idle.length} session`))
                .catch(() => undefined)
            }}
          />
        ) : null}
        {list.map(peer => (
          <Box key={`peer-${peer.id}`} flexDirection="column" marginTop={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={peer.isSelf ? P.accent : 'text'} bold={peer.isSelf} wrap="truncate-end">
                {peer.isSelf ? '★ ' : '  '}
                {peer.name}
              </Text>
              <Text color={peer.status === 'busy' ? P.warn : P.ok}>{peer.status === 'busy' ? '● bận' : '○ rảnh'}</Text>
            </Box>
            <Text color={P.muted} wrap="truncate-start">
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
                        .then(
                          r =>
                            void notice(
                              $,
                              r.isDelivered ? `✓ Đã gửi tới ${peer.name}` : `✗ Không gửi được: ${r.reason}`,
                            ),
                        )
                        .catch(() => void notice($, `✗ Không gửi được tới ${peer.name}`))
                    }}
                  />
                )}
                <Button
                  key={`resume-${peer.id}`}
                  label="Copy lệnh resume"
                  dimColor
                  onPress={() =>
                    void $.ui.copy({ text: `cd '${peer.cwd.replace(/'/g, `'\\''`)}' && claude --resume ${peer.id}` })
                  }
                />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PROMPTS_PANE }, async ($, e) => {
    const P = await palette($)
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const list = await read($, prompts)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color={P.muted}>Bấm để gửi; đang bận thì xếp hàng chạy sau. ctrl+x tab để gõ.</Text>
        {list.length === 0 && (
          <Text color={P.muted}>Chưa có prompt nào. Thêm ở ô dưới hoặc /mods save &lt;prompt&gt;.</Text>
        )}
        {list.map((text, i) => (
          <Box key={`prompt-${i}`} flexDirection="row" gap={1}>
            <Button
              key={`run-${i}`}
              label={text.length > 60 ? `${text.slice(0, 59)}…` : text}
              hotkey={i < 9 ? String(i + 1) : undefined}
              onPress={() => {
                void $.prompt.submit({ text })
                void notice($, 'Đã xếp hàng prompt')
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

  // Settings tab: every feature one press away, drawn in the active theme. Each
  // group heading is a gradient, toggles show a colored dot and a bar, and the
  // theme row shows every palette as a swatch.
  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const [[P, s], current] = await Promise.all([look($), read($, theme)])
    const { Box, Text, Button } = $.ui.resolve(e)
    const keys = Object.keys(SETTING_INFO) as (keyof Settings)[]
    const enabled = keys.filter(k => s[k]).length
    const pct = Math.round((enabled / Math.max(1, keys.length)) * 100)
    const bar = Math.max(10, Math.min(30, e.props.bodyColumns - 26))

    const heading = (text: string) => (
      <Box flexDirection="row" marginTop={1}>
        {gradientRuns(text, P.grad).map(r => (
          <Text color={r.color} bold>
            {r.ch}
          </Text>
        ))}
      </Box>
    )

    // Everything in one group or the catch-all "Khác": a new setting never goes missing.
    const placed = new Set(Object.values(SETTING_GROUPS).flat())
    const groups: [string, (keyof Settings)[]][] = [
      ...Object.entries(SETTING_GROUPS),
      ['Khác', keys.filter(k => !placed.has(k))],
    ]

    return (
      <Box flexDirection="column" width={e.props.bodyColumns} paddingX={1}>
        <Box flexDirection="row" gap={2}>
          {gradientRuns('⚙ Cài đặt', P.grad).map(r => (
            <Text color={r.color} bold>
              {r.ch}
            </Text>
          ))}
          <Text color={P.muted}>{`${enabled}/${keys.length} bật`}</Text>
        </Box>
        <Box flexDirection="row">
          {meterCells(pct, bar, P).map(c => (
            <Text color={c.color}>{c.ch}</Text>
          ))}
          <Text color={P.info}>{` ${pct}%`}</Text>
        </Box>

        <Box flexDirection="row" gap={1} marginTop={1}>
          <Button
            key="all-on"
            label="✦ Bật hết"
            dimColor
            onPress={() =>
              void setSettings($, Object.fromEntries(keys.filter(k => !EXPERIMENTAL.has(k)).map(k => [k, true])))
            }
          />
          <Button key="defaults" label="↺ Mặc định" dimColor onPress={() => void setSettings($, DEFAULTS)} />
        </Box>

        {heading('Theme')}
        {Object.keys(THEMES).map(name => {
          const pal = THEMES[name] ?? AUTO
          const isCurrent = name === current
          return (
            <Box flexDirection="row" gap={1}>
              <Text color={isCurrent ? P.ok : P.muted}>{isCurrent ? '●' : '○'}</Text>
              {pal.grad.map(c => (
                <Text color={c}>{'██'}</Text>
              ))}
              <Button
                key={`theme-${name}`}
                label={isCurrent ? `${name}  (đang dùng)` : name}
                plain
                onPress={() => void setTheme($, name)}
              />
            </Box>
          )
        })}

        {groups
          .filter(([, list]) => list.length > 0)
          .map(([title, list]) => (
            <Box flexDirection="column">
              {heading(`${title} · ${list.filter(k => s[k]).length}/${list.length}`)}
              {list.map(k => {
                const isOn = !!s[k]
                const experimental = EXPERIMENTAL.has(k)
                return (
                  <Box flexDirection="row" gap={1}>
                    <Box key={`dot-${k}`}>
                      {' '}
                      <Text color={isOn ? P.ok : P.muted} bold={isOn}>
                        {isOn ? '◉' : '○'}
                      </Text>
                    </Box>
                    <Button
                      key={`set-${k}`}
                      label={`${k.padEnd(12)}`}
                      plain
                      dimColor={!isOn}
                      onPress={() => void setSetting($, k, !isOn)}
                    />
                    <Text color={experimental ? P.warn : isOn ? P.accent : P.muted} wrap="truncate-end">
                      {`${experimental ? '⚗ ' : ''}${SETTING_INFO[k]}`}
                    </Text>
                  </Box>
                )
              })}
            </Box>
          ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: SELECTION_PANE }, async ($, e) => {
    const P = await palette($)
    const { Box, Text, Button } = $.ui.resolve(e)
    const text = await read($, selection)
    if (!text) {
      return <Text color={P.muted}>Bôi đen một đoạn trong transcript rồi bấm [Chọn] hoặc /mods sel.</Text>
    }
    const ask = (verb: string) => () => {
      void $.prompt.submit({ text: `${verb}:\n\n${text}` })
      void notice($, 'Đã xếp hàng prompt')
    }

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color={P.muted}>{text.length > 400 ? `${text.slice(0, 399)}…` : text}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
          <Button key="explain" label="Giải thích" hotkey="1" onPress={ask('Giải thích đoạn sau')} />
          <Button key="translate" label="Dịch Việt ⇄ Anh" hotkey="2" onPress={ask('Dịch đoạn sau (Việt ⇄ Anh)')} />
          <Button key="summarize" label="Tóm tắt" hotkey="3" onPress={ask('Tóm tắt ngắn gọn đoạn sau')} />
          <Button
            key="copy"
            label="Copy sạch"
            hotkey="4"
            onPress={() =>
              void $.ui.copy({
                text: text
                  .split('\n')
                  .map(line => line.trimEnd())
                  .join('\n')
                  .trim(),
                surface: e.surface,
              })
            }
          />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: FIND_PANE }, async ($, e) => {
    const P = await palette($)
    const { Box, Text } = $.ui.resolve(e)
    const hits = await read($, found)
    const q = await read($, query)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color={P.muted}>
          {hits.length} kết quả cho “{q}”
        </Text>
        {hits.map(h => (
          <Box flexDirection="column" marginTop={1}>
            <Text color={h.role === 'user' ? P.accent : P.info} bold>
              {h.role === 'user' ? '❯ Bạn' : '◆ Claude'}
            </Text>
            <Text>{h.snippet}</Text>
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: TODO_PANE }, async ($, e) => {
    const P = await palette($)
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const list = await read($, todos)
    const open = list.filter(x => !x.done).length

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color={P.muted}>
          {open} đang mở · {list.length - open} xong · bấm để đánh dấu
        </Text>
        {list.length === 0 && <Text color={P.muted}>Chưa có TODO. Thêm ở ô dưới hoặc /mods todo &lt;việc&gt;.</Text>}
        {list.map((item, i) => (
          <Box key={`todo-${i}`} flexDirection="row" gap={1}>
            <Button
              key={`todo-toggle-${i}`}
              label={`${item.done ? '☑' : '☐'} ${item.text}${item.file ? `  (${baseName(item.file)})` : ''}`}
              plain
              dimColor={item.done}
              onPress={() => void setTodos($, l => l.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            />
            <Button
              key={`todo-del-${i}`}
              label="✕"
              dimColor
              onPress={() => void setTodos($, l => l.filter((_, j) => j !== i))}
            />
          </Box>
        ))}
        <Box flexDirection="row" gap={1} marginTop={1}>
          <Button
            key="todo-clear"
            label="Xóa việc đã xong"
            dimColor
            onPress={() => void setTodos($, l => l.filter(x => !x.done))}
          />
        </Box>
        {Input ? (
          <Input
            key="todo-new"
            placeholder="Thêm việc…"
            submitLabel="Thêm"
            onSubmit={text => {
              if (text.trim()) void addTodos($, [{ text: text.trim(), done: false }])
            }}
          />
        ) : null}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: MONITOR_PANE }, async ($, e) => {
    const P = await palette($)
    const { Box, Text } = $.ui.resolve(e)
    const [rows, live, use, now] = await Promise.all([read($, agentStats), read($, agents), read($, usage), $.clock.now()])
    if (rows.length === 0) return <Text color={P.muted}>Chưa có phản hồi nào của model trong session này.</Text>
    const byId = new Map(live.map(a => [a.id, a]))
    const running = live.filter(a => a.status === 'running' || a.status === 'pending' || a.status === 'waiting').length
    const total = rows.reduce((sum, r) => sum + r.usd, 0)
    const sorted = [...rows].sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : b.lastAt - a.lastAt))

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Box flexDirection="row" gap={2} flexWrap="wrap">
          <Text color={P.accent} bold>{`🤖 ${running} agent đang chạy`}</Text>
          <Text color={P.muted}>{`${rows.length - (rows.some(r => r.id === 'main') ? 1 : 0)} agent trong session`}</Text>
          <Text color={P.warn}>{`≈ $${total.toFixed(2)} ước tính`}</Text>
          {use?.usd != null ? <Text color={P.ok}>{`session thật: $${use.usd.toFixed(2)}`}</Text> : null}
        </Box>
        {sorted.map(r => {
          const info = byId.get(r.id)
          const isLive = r.id === 'main' || (info ? ['running', 'pending', 'waiting'].includes(info.status) : false)
          const name = r.id === 'main' ? 'Main' : (info?.label ?? r.id.slice(0, 8))
          const ms = (isLive && r.id !== 'main' ? now : r.lastAt) - r.startedAt
          return (
            <Box key={`mon-${r.id}`} flexDirection="column" marginTop={1}>
              <Box flexDirection="row" gap={1}>
                <Text color={isLive ? P.ok : P.muted}>{isLive ? '●' : '○'}</Text>
                <Text color={r.id === 'main' ? P.accent : P.violet} bold wrap="truncate-end">
                  {name}
                </Text>
                <Text color={P.muted}>{info?.status ?? (r.id === 'main' ? '' : 'xong')}</Text>
              </Box>
              <Text color={P.muted} wrap="wrap">
                {`  ${shortModel(r.model)}${r.effort ? ` · ${r.effort}` : ''} · ${duration(Math.max(0, ms))} · ${r.steps} lần gọi`}
              </Text>
              <Text wrap="wrap">
                {`  ctx ${tok(r.context)} · in ${tok(r.input)} · out ${tok(r.output)} · cache ${tok(r.cacheRead)}/${tok(r.cacheWrite)} · ≈ $${r.usd.toFixed(3)}`}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: REPLAY_PANE }, async ($, e) => {
    const P = await palette($)
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const [steps, at] = await Promise.all([read($, replay), read($, replayAt)])
    if (steps.length === 0) return <Text color={P.muted}>Chưa có lượt nào sửa file.</Text>
    const i = Math.min(at, steps.length - 1)
    const step = steps[i] ?? steps[0]!
    const go = (to: number) => void update($, replayAt, () => Math.max(0, Math.min(steps.length - 1, to)))

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Box flexDirection="row" gap={1}>
          <Text color={P.accent} bold>{`Bước ${i + 1}/${steps.length}`}</Text>
          <Text color={P.muted}>{step.tool}</Text>
          <Text color={P.ok}>{`+${step.added}`}</Text>
          <Text color={P.err}>{`−${step.removed}`}</Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap">
          {steps.map((_, j) => (
            <Text key={`rp-cell-${j}`} color={j === i ? P.ink : P.muted} {...(j === i ? { backgroundColor: P.accent } : {})}>
              {` ${j + 1} `}
            </Text>
          ))}
        </Box>
        <Text color={P.muted} wrap="truncate-start">
          {step.path}
        </Text>
        <Code source={step.diff} format="diff" path={step.path} />
        <Box flexDirection="row" gap={1}>
          <Button key="rp-prev" label="◀ Prev" hotkey="p" onPress={() => go(i - 1)} />
          <Button key="rp-next" label="Next ▶" hotkey="n" onPress={() => go(i + 1)} />
          <Button
            key="rp-explain"
            label="💡 Explain"
            hotkey="e"
            onPress={() =>
              void $.prompt
                .submit({ text: `Giải thích ngắn gọn vì sao có thay đổi này ở ${step.path}:\n~~~~diff\n${step.diff}\n~~~~` })
                .then(() => notice($, 'Đã xếp hàng prompt'))
                .catch(() => undefined)
            }
          />
          <Button key="rp-close" label="✕ Close" hotkey="c" onPress={() => void $.ui.close({ id: REPLAY_PANE })} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: ACCOUNTS_PANE }, async ($, e) => {
    const P = await palette($)
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const acc = await read($, accounts)
    if (!acc) return <Text color={P.muted}>Đang tải…</Text>

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        {acc.list.map((a, i) => (
          <Box key={`acc-${a.name}`} flexDirection="row" gap={1}>
            <Text color={a.active ? P.ok : P.muted}>{a.active ? '●' : '○'}</Text>
            <Text color={a.disabled ? P.muted : P.accent} bold={a.active}>
              {a.name}
            </Text>
            {a.email ? (
              <Text color={P.muted} wrap="truncate-end">
                {a.email}
              </Text>
            ) : null}
            {!a.active && !a.disabled ? (
              <Button
                key={`acc-use-${i}`}
                label="Đổi"
                {...(i < 9 ? { hotkey: String(i + 1) } : {})}
                onPress={() => void accountRun($, `swap ${a.name}`)}
              />
            ) : null}
            {/* Deleting has no undo: it only fills the prompt, the person sends it. */}
            <Button
              key={`acc-del-${i}`}
              label="✕"
              dimColor
              onPress={() => void $.prompt.fill({ text: `/profile delete ${a.name}`, mode: 'replace' })}
            />
          </Box>
        ))}
        {acc.note ? (
          <Text color={P.warn} wrap="wrap">
            {acc.note}
          </Text>
        ) : null}
        <Text color={P.muted} wrap="wrap">
          Thêm tài khoản: /login bằng tài khoản mới, rồi đặt tên bên dưới để lưu nó thành profile.
        </Text>
        {Input ? (
          <Input
            key="acc-new"
            placeholder="Tên profile mới…"
            submitLabel="Lưu tài khoản đang đăng nhập"
            onSubmit={text => {
              const name = text.trim()
              if (PROFILE_NAME.test(name)) void accountRun($, `new ${name}`)
              else void update($, accounts, a => (a ? { ...a, note: `Tên profile không hợp lệ: ${name}` } : a))
            }}
          />
        ) : null}
        <Box flexDirection="row" gap={1}>
          <Button key="acc-refresh" label="Làm mới" hotkey="r" onPress={() => void loadAccounts($)} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: NOTES_PANE }, async ($, e) => {
    const P = await palette($)
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const list = await read($, notes)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color={P.muted}>Ghi chú của dự án, giữ qua các session.</Text>
        {list.length === 0 && <Text color={P.muted}>Chưa có ghi chú.</Text>}
        {list.map((note, i) => (
          <Box key={`note-${i}`} flexDirection="row" gap={1}>
            <Text color={P.accent}>•</Text>
            <Text wrap="wrap">{note}</Text>
            <Button
              key={`note-del-${i}`}
              label="✕"
              dimColor
              onPress={() => void setNotes($, l => l.filter((_, j) => j !== i))}
            />
          </Box>
        ))}
        {list.length > 0 && (
          <Box flexDirection="row" marginTop={1}>
            <Button
              key="notes-send"
              label="Gửi ghi chú cho Claude"
              onPress={() => {
                void $.prompt.submit({ text: `Ghi chú của tôi cho dự án này:\n${list.map(n => `- ${n}`).join('\n')}` })
                void notice($, 'Đã xếp hàng prompt')
              }}
            />
          </Box>
        )}
        {Input ? (
          <Input
            key="note-new"
            placeholder="Ghi chú mới…"
            submitLabel="Lưu"
            onSubmit={text => {
              if (text.trim()) void setNotes($, l => [...l, text.trim()].slice(-50))
            }}
          />
        ) : null}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: COMMIT_PANE }, async ($, e) => {
    const P = await palette($)
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Input = 'Input' in t ? t.Input : undefined
    const draft = await read($, commitDraft)
    if (!draft) return <Text color={P.muted}>Gõ /mods commit để soạn message từ phần đã stage.</Text>

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Text color={P.muted}>{draft.files} file đã stage · commit chạy không kèm git hooks</Text>
        {draft.note && <Text color={P.warn}>{draft.note}</Text>}
        {draft.message && (
          <Box borderStyle="round" borderColor={P.accent} paddingX={1} marginY={1}>
            <Text wrap="wrap">{draft.message}</Text>
          </Box>
        )}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {draft.message && <Button key="commit-go" label="Commit" hotkey="1" onPress={() => void commitNow($)} />}
          {draft.message && (
            <Button
              key="commit-copy"
              label="Copy lệnh (chạy cả hooks)"
              hotkey="2"
              onPress={() =>
                void $.ui.copy({ text: `git commit -m '${draft.message.replace(/'/g, `'\\''`)}'`, surface: e.surface })
              }
            />
          )}
          <Button key="commit-redo" label="Viết lại" hotkey="3" onPress={() => void draftCommit($)} />
          {draft.files === 0 && (
            <Button
              key="commit-stage"
              label="Stage tất cả"
              hotkey="4"
              onPress={() =>
                void (async () => {
                  const base = await read($, root)
                  if (await gitIsSafe($, base)) await stageAll($, base)
                  await draftCommit($)
                })()
              }
            />
          )}
          <Button key="commit-cancel" label="Hủy" dimColor onPress={() => void update($, commitDraft, () => null)} />
        </Box>
        {Input ? (
          <Input
            key="commit-edit"
            placeholder="Hoặc tự gõ message…"
            submitLabel="Dùng"
            onSubmit={text => {
              if (text.trim()) void update($, commitDraft, d => (d ? { ...d, message: text.trim(), note: '' } : d))
            }}
          />
        ) : null}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: CONTEXT_PANE }, async ($, e) => {
    const P = await palette($)
    const { Box, Text, Button } = $.ui.resolve(e)
    const b = await read($, breakdown)
    if (!b) return <Text color={P.muted}>Chưa có số liệu (cần ít nhất một lượt).</Text>
    const width = Math.max(10, e.props.bodyColumns - 34)
    const top = [...b.categories].sort((x, y) => y.tokens - x.tokens)

    return (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        <Box flexDirection="row">
          {meterCells(Math.round((b.total / Math.max(1, b.max)) * 100), Math.min(30, width), P).map(c => (
            <Text color={c.color}>{c.ch}</Text>
          ))}
          <Text color={P.muted}>{`  ${Math.round(b.total / 1000)}k / ${Math.round(b.max / 1000)}k token`}</Text>
        </Box>
        {top.map(c => {
          const cells = Math.max(1, Math.round((c.tokens / Math.max(1, b.total)) * width))
          return (
            <Box flexDirection="row">
              <Text wrap="truncate-end">{c.name.slice(0, 22).padEnd(23)}</Text>
              <Text color={c.color}>{'█'.repeat(cells)}</Text>
              <Text color={P.muted}>{` ${(c.tokens / 1000).toFixed(1)}k`}</Text>
            </Box>
          )
        })}
        <Box marginTop={1}>
          <Button key="context-refresh" label="Làm mới" dimColor onPress={() => void refreshBreakdown($)} />
        </Box>
      </Box>
    )
  })

  // Collapse (24): a long Bash output shows its head and a press to open it.
  on('ui.render', { component: 'ToolResult', props: { tool: 'Bash' } }, async ($, e, next) => {
    if (!(await read($, settings)).collapse || e.props.isErrored) return next(e)
    const out = e.props.output as { stdout?: unknown } | undefined
    const lines = typeof out?.stdout === 'string' ? out.stdout.replace(/\n+$/, '').split('\n') : []
    if (lines.length <= COLLAPSE_LINES + 2) return next(e)
    const id = e.props.tool_use_id
    if ((await read($, expanded)).includes(id)) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {lines.slice(0, COLLAPSE_LINES).map(line => (
          <Text wrap="truncate-end">{line}</Text>
        ))}
        <Button
          key={`more-${id}`}
          label={`… ${lines.length - COLLAPSE_LINES} dòng nữa · bấm để mở`}
          plain
          dimColor
          onPress={() => void update($, expanded, list => [...list, id].slice(-200))}
        />
      </Box>
    )
  })

  // Badges (25): one coloured label per tool row; hover (36) shows the whole input.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const [P, s] = await look($)
    const { tool, isRunning, isErrored, isInterrupted, tool_use_id } = e.props
    const isMcp = tool.startsWith('mcp__')
    if (!s.badges || !(tool in BADGE || isMcp)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const name = isMcp ? (tool.split('__').pop() ?? tool) : tool
    const color = P[BADGE[tool] ?? 'pink']
    const [icon, iconColor] = isRunning
      ? ['◌', P.warn]
      : isInterrupted
        ? ['⊘', P.muted]
        : isErrored
          ? ['✗', P.err]
          : ['✓', P.ok]

    return (
      <Box key={`row-${tool_use_id}`} flexDirection="row" gap={1}>
        <Text color={iconColor}>{icon}</Text>
        <Text backgroundColor={color} color={P.ink} bold>
          {` ${name} `}
        </Text>
        <Text
          color={P.muted}
          wrap={tool === 'Bash' ? 'wrap' : 'truncate-end'}
          hover={s.hovercards ? { color: color, bold: true } : undefined}
        >
          {summaryOf(e.props.input)}
        </Text>
      </Box>
    )
  })

  // /mods output in color: a card with gradient headings, commands in the
  // accent, [bật]/[tắt] as colored dots, and ✓/✗ results by outcome.
  on('ui.render', { component: 'CommandOutput', props: { command: 'mods' } }, async ($, e, next) => {
    const [P, s] = await look($)
    if (e.props.isErrored || !s.decor) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const lines = e.props.text
      .replace(/^terminal-polish:\s*/, '')
      .replace(/\n+$/, '')
      .split('\n')
    const ICONS: Record<string, string> = { Bảng: '📊', 'Công cụ': '🧰', 'Phiên bản': '🔄', 'Bật/tắt': '🔀' }
    const RESULT: Record<string, string> = { '✓': P.ok, '✗': P.err, '⚠': P.warn, '🔐': P.warn, '💰': P.pink }

    const gradient = (text: string) =>
      gradientRuns(text, P.grad).map(r => (
        <Text color={r.color} bold>
          {r.ch}
        </Text>
      ))

    const view = (line: string, i: number) => {
      if (i === 0 && line.startsWith('Cách dùng')) {
        return (
          <Box flexDirection="row" gap={2} marginBottom={1}>
            <Box flexDirection="row">{gradient('◆ terminal-polish')}</Box>
            <Text color={P.muted}>{line}</Text>
          </Box>
        )
      }
      const toggle = line.match(/^ {2}(\S+)\s+\[(bật|tắt)\] (.*)$/)
      if (toggle) {
        const [, key = '', state, desc = ''] = toggle
        const isOn = state === 'bật'
        return (
          <Box flexDirection="row">
            <Text color={isOn ? P.ok : P.muted}>{isOn ? '  ● ' : '  ○ '}</Text>
            <Text color={isOn ? P.accent : P.muted} bold={isOn}>
              {key.padEnd(12)}
            </Text>
            <Text color={isOn ? undefined : P.muted} dimColor={!isOn} wrap="truncate-end">
              {desc}
            </Text>
          </Box>
        )
      }
      if (/^\S.*:$/.test(line)) {
        const label = line.replace(/:$/, '')
        const icon = Object.entries(ICONS).find(([k]) => label.startsWith(k))?.[1] ?? '▸'
        return (
          <Box flexDirection="row" marginTop={i > 0 ? 1 : 0}>
            <Text>{`${icon} `}</Text>
            {gradient(label)}
          </Box>
        )
      }
      const command = line.match(/^ {2}(\S.*?)\s{2,}(.*)$/)
      if (command) {
        return (
          <Box flexDirection="row">
            <Text color={P.info} bold>{`  ${(command[1] ?? '').padEnd(18)}`}</Text>
            <Text wrap="truncate-end">{command[2]}</Text>
          </Box>
        )
      }
      const mark = [...line.trimStart()][0] ?? ''
      return (
        <Text color={RESULT[mark]} wrap="wrap">
          {line || ' '}
        </Text>
      )
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={P.accent} paddingX={1}>
        {lines.map(view)}
      </Box>
    )
  })

  // The person's prompts.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const from = e.props.origin
    if (from.kind !== 'composer') return next(e)
    const [[P, s], pics] = await Promise.all([look($), picsFor($, e.requestId, e.props.text)])
    if (!s.cards && !s.frame && !s.msgactions && !pics.length) return next(e)
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const Image = 'Image' in t ? t.Image : undefined

    // Frame: a rounded box around the whole message, no edge glyphs inside it.
    // Card: a rounded bracket down the left (╭ │ ╰, one line ╰), ❯ on the first line.
    const bracket = s.cards && !s.frame
    const lines = e.props.text.split('\n')
    const edge = (i: number) => (i === lines.length - 1 ? '╰ ' : i === 0 ? '╭ ' : '│ ')
    const row = (
      <Box flexDirection="column">
        {lines.map((line, i) => (
          <Box flexDirection="row">
            {bracket ? <Text color={P.accent}>{edge(i)}</Text> : null}
            <Text color={P.accent} bold>
              {i === 0 ? '❯ ' : '  '}
            </Text>
            <Text wrap="wrap">{line || ' '}</Text>
          </Box>
        ))}
      </Box>
    )
    const thumbs = pics.length > 0 && (
      <Box flexDirection="row" flexWrap="wrap" gap={2} marginTop={1} marginLeft={bracket ? 4 : 2}>
        {pics.map((pic, i) => (
          <Box flexDirection="column">
            {s.images && Image && pic.mediaType === 'image/png' && pic.data.length <= IMAGE_MAX_BASE64 ? (
              <Image key={`img-${i}`} source={{ png: pic.data }} {...thumbSize(pic.data)} alt={pic.label} />
            ) : null}
            <Button
              key={`open-${e.requestId}-${i}`}
              label={`🖼 ${pic.label} · mở`}
              plain
              dimColor
              onPress={() => void openPic($, pic)}
            />
          </Box>
        ))}
      </Box>
    )

    // Cancel and edit show on the running turn's own prompt only; edit while the turn has not edited a file yet.
    // ponytail: matched by text, so an identical earlier prompt shows them too; key on a row id if one appears.
    const [live, work] = s.msgactions ? await Promise.all([read($, liveTurn), read($, turn)]) : [null, null]
    const lost = s.msgactions ? await read($, failed) : null
    const liveId = live && live.text === e.props.text ? live.id : undefined
    const icon = (glyph: string, color: string, word: string) => [
      <Text color={color}>{glyph}</Text>,
      <Text color={P.muted}>{` ${word} `}</Text>,
    ]
    const actions = s.msgactions ? (
      <Box flexDirection="row" gap={2} marginLeft={bracket ? 4 : 2}>
        <Button key={`copy-${e.requestId}`} label="Sao chép" plain onPress={() => void copyText($, e.props.text)}>
          {icon('📋', P.cyan, 'Copy')}
        </Button>
        <Button key={`save-${e.requestId}`} label="Lưu" plain onPress={() => void savePrompt($, e.props.text)}>
          {icon('⭐', P.ok, 'Save')}
        </Button>
        {lost?.text === e.props.text && !liveId ? (
          <Button
            key={`retry-${e.requestId}`}
            label="Gửi lại"
            plain
            onPress={() => void $.prompt.submit({ text: e.props.text })}
          >
            {icon('🔄', P.info, 'Retry')}
          </Button>
        ) : null}
        {liveId && !work?.edits ? (
          <Button
            key={`edit-${e.requestId}`}
            label="Sửa"
            plain
            onPress={() =>
              void $.turn
                .abort({ turnId: liveId })
                .catch(() => undefined)
                .then(() => $.prompt.fill({ text: e.props.text, mode: 'replace' }))
            }
          >
            {icon('📝', P.warn, 'Edit')}
          </Button>
        ) : null}
        {liveId ? (
          <Button
            key={`abort-${e.requestId}`}
            label="Huỷ"
            plain
            onPress={() => void $.turn.abort({ turnId: liveId }).catch(() => undefined)}
          >
            {icon('🛑', P.err, 'Stop')}
          </Button>
        ) : null}
      </Box>
    ) : null

    return (
      <Box
        flexDirection="column"
        {...(s.frame ? { borderStyle: 'round', borderColor: P.accent, paddingX: 1 } : {})}
      >
        {row}
        {thumbs}
        {actions}
      </Box>
    )
  })

  // Each fenced code block of a reply gets a copy button under the reply.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const s = await read($, settings)
    const show = s.msgactions && !e.props.isSummary
    const blocks = show ? codeBlocks(e.props.text) : []
    const links = show ? linksOf(e.props.text) : []
    if (!blocks.length && !links.length) return next(e)
    const [P] = await look($)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {await next(e)}
        <Box flexDirection="row" gap={2} marginLeft={2}>
          {blocks.map((b, i) => (
            <Button
              key={`code-${e.requestId}-${i}`}
              label={`Sao chép code ${b.lang || i + 1}`}
              plain
              dimColor
              onPress={() => void copyText($, b.code)}
            >
              <Text color={P.cyan}>📋</Text>
              <Text color={P.muted}>{` Copy${b.lang ? ` ${b.lang}` : ''} `}</Text>
            </Button>
          ))}
          {links.map((l, i) => (
            <Button key={`open-${e.requestId}-${i}`} label={baseName(l.replace(/\/+$/, '')) || l} plain dimColor onPress={() => void openTarget($, l)}>
              <Text color={P.cyan}>🔗</Text>
              <Text color={P.muted}> Open </Text>
            </Button>
          ))}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const s = await read($, settings)
    if (!s.decor && !s.fun) return next(e)
    return next({
      ...e,
      props: {
        ...e.props,
        ...(s.decor ? { word: SPINNER_WORDS[e.props.mode] ?? e.props.word } : {}),
        // One joke per turn, picked when the turn starts.
        ...(s.fun ? { suffix: `${e.props.suffix ?? ''} · ${JOKES[jokeAt % JOKES.length]}` } : {}),
      },
    })
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (!(await read($, settings)).decor || e.props.isDraft) return next(e)
    return next({ ...e, props: { ...e.props, tail: '· /mods ⚙' } })
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const [P, s] = await look($)
    if (!s.decor) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text color={P.muted}>✓ Xong sau {duration(e.props.durationMs)}</Text>
  })
}
