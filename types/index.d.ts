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
}
export type Git = { branch: string; changed: number }
export type Turn = { tools: number; failed: number }
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
      theme: string
      fx: 'comet' | 'party' | null
      splash: boolean
      splashInfo: SplashInfo | null
      heat: Record<string, number>
    }
  }
}
