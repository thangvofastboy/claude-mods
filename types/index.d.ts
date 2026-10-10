export type Settings = {
  band: boolean
  cards: boolean
  tldr: boolean
  notify: boolean
  sound: boolean
  voice: boolean
  guard: boolean
  decor: boolean
  quota: boolean
  autocompact: boolean
  abbrev: boolean
  rules: boolean
  tools: boolean
  automodel: boolean
  journal: boolean
  collapse: boolean
  badges: boolean
  gradient: boolean
  powerline: boolean
  meters: boolean
  statecolor: boolean
  fileicons: boolean
  anim: boolean
  confetti: boolean
  splash: boolean
  heatmap: boolean
  hovercards: boolean
  images: boolean
  secrets: boolean
  budget: boolean
  checkpoints: boolean
  branchlock: boolean
  format: boolean
  autocheck: boolean
  compactplus: boolean
  todos: boolean
  notices: boolean
}
export type Git = { branch: string; changed: number }
export type Turn = { tools: number; failed: number; edits: number }
export type LastTurn = { seconds: number; tools: number; failed: number }
export type Limit = { kind: string; percent: number }
export type Usage = { percent: number | null; usd: number | null; limits: Limit[] }
export type Totals = { turns: number; seconds: number; tools: number }
export type Found = { role: 'user' | 'assistant'; snippet: string }
export type TimerState = { endsAt: number; left: number }
export type Peer = { id: string; name: string; cwd: string; status: string; isSelf: boolean }
export type Agent = { id: string; label: string; status: string }
export type Diff = { path: string; text: string; note: string }
export type Call = { id: string; tool: string; label: string; state: 'run' | 'ok' | 'fail'; ms?: number }
export type Checkpoint = { id: number; path: string; copy: string | null; at: number }
export type Todo = { text: string; done: boolean; file?: string }
export type CommitDraft = { message: string; files: number; note: string }
export type CheckResult = { ok: boolean; command: string; output: string; at: number }
export type Category = { name: string; tokens: number; color: string }
export type Breakdown = { categories: Category[]; total: number; max: number }
export type Notice = { id: number; icon: string; kind: 'ok' | 'err' | 'warn' | 'info' | 'pink'; text: string }
export type SplashInfo = { greeting: string; last: string; tip: string }

declare module 'claude-code' {
  interface PluginState {
    'terminal-polish': {
      settings: Settings
      project: string
      git: Git | null
      turn: Turn | null
      last: LastTurn | null
      history: LastTurn[]
      usage: Usage | null
      calls: Call[]
      files: string[]
      peers: Peer[]
      agents: Agent[]
      diff: Diff | null
      prompts: string[]
      root: string
      home: string
      startedAt: number
      totals: Totals
      lastUsd: number | null
      ctxWarned: boolean
      rules: string[]
      selection: string | null
      found: Found[]
      query: string
      timer: TimerState | null
      expanded: string[]
      autoModel: string | null
      openCalls: string[]
      notices: Notice[]
      theme: string
      fx: 'comet' | 'party' | null
      splash: boolean
      splashInfo: SplashInfo | null
      heat: Record<string, number>
      checkpoints: Checkpoint[]
      todos: Todo[]
      notes: string[]
      commitDraft: CommitDraft | null
      check: CheckResult | null
      checkCommand: string
      breakdown: Breakdown | null
      budgetWarned: string
      spentToday: number
      budgetLimit: number
    }
  }
}
