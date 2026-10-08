import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Post } from '../types'

const SERVER = 'daily-dev'
const posts = atom({ plugin: 'dailydev-feed', key: 'posts' } as const, [])
const index = atom({ plugin: 'dailydev-feed', key: 'index' } as const, 0)
const isHidden = atom({ plugin: 'dailydev-feed', key: 'isHidden' } as const, false)

type RawPost = {
  id: string
  title?: string
  url?: string
  summary?: string
  commentsPermalink?: string
  readTime?: number
  numUpvotes?: number
  numComments?: number
  source?: { name?: string }
}

export function toPosts(text: string): Post[] {
  const data = (JSON.parse(text) as { data?: RawPost[] }).data ?? []
  return data
    .filter(p => p.title && p.url)
    .map(p => ({
      id: p.id,
      title: p.title!,
      url: p.url!,
      summary: p.summary ?? '',
      source: p.source?.name ?? '',
      readTime: p.readTime ?? 0,
      upvotes: p.numUpvotes ?? 0,
      comments: p.numComments ?? 0,
      commentsUrl: p.commentsPermalink ?? p.url!,
    }))
}

// MCP calls share the user's daily.dev API quota, so fetch at most every 8h.
const CACHE_MS = 8 * 60 * 60 * 1000
type Cache = { at: number; posts: Post[]; index: number }

async function load($: EngineInterface) {
  const cache = (await $.store.get('cache')) as Cache | undefined
  if (cache && (await $.clock.now()) - cache.at < CACHE_MS) {
    await update($, posts, () => cache.posts)
    await update($, index, () => cache.index)
    return
  }
  try {
    const res = await $.mcp.call(SERVER, 'getFeedsForyou', { limit: 30 })
    const text = res.content.find(b => b.type === 'text')?.text
    if (res.isError || !text) return
    const fresh = toPosts(text)
    if (fresh.length === 0) return
    await $.store.set('cache', { at: await $.clock.now(), posts: fresh, index: 0 })
    await update($, posts, () => fresh)
    await update($, index, () => 0)
  } catch {
    // ponytail: silent on failure (server down / not authed); band just stays empty
  }
}

async function step($: EngineInterface, by: number) {
  const list = await read($, posts)
  if (list.length === 0) return
  const next = ((await read($, index)) + by + list.length) % list.length
  await update($, index, () => next)
  const cache = (await $.store.get('cache')) as Cache | undefined
  if (cache) await $.store.set('cache', { ...cache, index: next })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dailydev',
      description: 'Show or hide daily.dev posts while Claude works',
    })
    void load($)
    return next(e)
  })

  on('command.run', { command: 'dailydev' }, async $ => {
    const hidden = await update($, isHidden, h => !h)
    return { text: hidden ? 'daily.dev posts hidden.' : 'daily.dev posts shown while Claude works.' }
  })

  // New post for every prompt.
  on('turn.complete', async ($, e, next) => {
    await step($, 1)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!e.props.isWorking || e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const list = await read($, posts)
    const post = list[await read($, index)]
    if (!post) return next(e)

    const { Box, Text, Link, Button } = $.ui.resolve(e)
    const summary = post.summary.length > 420 ? post.summary.slice(0, 420) + '…' : post.summary

    return (
      <Box flexDirection="column">
        <Text color="claude" bold>
          daily.dev · {post.title}
        </Text>
        <Text dimColor>
          {post.source} · {post.readTime}m read · ▲{post.upvotes} · 💬{post.comments}
        </Text>
        {summary && <Text wrap="wrap">{summary}</Text>}
        <Box>
          <Link href={post.url} label="Open post" />
          <Text> · </Text>
          <Link href={post.commentsUrl} label="Discussion" />
          <Text> </Text>
          <Button key="prev" label="Prev" onPress={() => step($, -1)} />
          <Button key="next" label="Next" onPress={() => step($, 1)} />
          <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
        </Box>
      </Box>
    )
  })
}
