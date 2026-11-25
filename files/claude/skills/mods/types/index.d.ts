export type MainStep = {
  effort?: string
  cacheHitRatio?: number
}

export type GitStatus = {
  branch: string
  changed: number
  ahead: number
  behind: number
}

export type StatusSnapshot = {
  project: string
  subdir?: string
  jump?: string
  git: GitStatus | null
  model: string
  effort?: string
  costUsd: number
  contextTokens: number
  contextPercent: number
  cacheHitRatio?: number
  rateLimits: { kind: string; percent: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    mods: { snapshot: StatusSnapshot | null; mainStep: MainStep | null }
  }
}
