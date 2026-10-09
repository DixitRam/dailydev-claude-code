import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Post } from '../types'

const SERVER = 'daily-dev'
const BRAND = '#CE3DF3' // daily.dev purple
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
  tags?: string[]
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
      tags: p.tags ?? [],
    }))
}

// MCP calls share the user's daily.dev API quota, so fetch at most every 8h.
const CACHE_MS = 8 * 60 * 60 * 1000
type Cache = { at: number; posts: Post[]; index: number }

// Returns false when the cache is missing or stale.
async function loadCache($: EngineInterface) {
  const cache = (await $.store.get('cache')) as Cache | undefined
  if (!cache || (await $.clock.now()) - cache.at >= CACHE_MS) return false
  await update($, posts, () => cache.posts)
  await update($, index, () => cache.index)
  return true
}

async function fetchFeed($: EngineInterface) {
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
    // Cache read is fast; the network fetch must not hold up session start.
    if (!(await loadCache($))) void fetchFeed($)
    return next(e)
  })

  on('command.run', { command: 'dailydev' }, async $ => {
    const hidden = await update($, isHidden, h => !h)
    return { text: hidden ? 'daily.dev posts hidden.' : 'daily.dev posts shown while Claude works.' }
  })

  // The session.start fetch can run before daily-dev connects; retry while empty.
  on('turn.start', async ($, e, next) => {
    if ((await read($, posts)).length === 0) void fetchFeed($)
    return next(e)
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
    const width = e.props.bodyColumns
    // ~3 lines of summary inside the frame (2 border + 2 padding columns).
    const room = Math.max(80, (width - 4) * 3)
    const summary = post.summary.length > room ? post.summary.slice(0, room - 1).trimEnd() + '…' : post.summary
    const tags = (post.tags ?? []).slice(0, 3).map(t => `#${t}`).join(' ')
    const meta = [post.source, `${post.readTime} min read`, `▲ ${post.upvotes}`, `💬 ${post.comments}`, tags]
      .filter(Boolean)
      .join('  ·  ')

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={BRAND} paddingX={1} width={width}>
        <Box justifyContent="space-between">
          <Text color={BRAND} bold>
            daily.dev · For You
          </Text>
          {/* Buttons live up here: the footer's links grow long where the terminal prints URLs. */}
          <Box gap={1}>
            <Text dimColor>
              {(await read($, index)) + 1}/{list.length}
            </Text>
            <Button key="prev" label="◀ Prev" onPress={() => step($, -1)} />
            <Button key="next" label="Next ▶" onPress={() => step($, 1)} />
            <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text bold wrap="truncate-end">
            {post.title}
          </Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {meta}
        </Text>
        {summary && (
          <Box marginTop={1}>
            <Text wrap="wrap">{summary}</Text>
          </Box>
        )}
        <Box marginTop={1} gap={3} flexWrap="wrap">
          <Link href={post.url} label="↗ Read post" />
          <Link href={post.commentsUrl} label="💬 Discussion" />
        </Box>
      </Box>
    )
  })
}
