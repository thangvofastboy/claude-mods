export type Settings = {
  band: boolean
  cards: boolean
  tldr: boolean
  notify: boolean
  sound: boolean
  voice: boolean
  guard: boolean
  decor: boolean
}
export type Git = { branch: string; changed: number }
export type Turn = { tools: number; failed: number }
export type LastTurn = { seconds: number; tools: number; failed: number }
export type Usage = { percent: number | null; usd: number | null }
export type Peer = { id: string; name: string; cwd: string; status: string; isSelf: boolean }
export type Agent = { id: string; label: string; status: string }
export type Diff = { path: string; text: string; note: string }
export type Call = { id: string; tool: string; label: string; state: 'run' | 'ok' | 'fail' }

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
    }
  }
}
