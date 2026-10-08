export type Post = {
  id: string
  title: string
  url: string
  summary: string
  source: string
  readTime: number
  upvotes: number
  comments: number
  commentsUrl: string
  /** Absent in caches written before 0.2.0. */
  tags?: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'dailydev-feed': { posts: Post[]; index: number; isHidden: boolean }
  }
}
