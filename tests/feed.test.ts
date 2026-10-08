import { expect, test } from 'claude-code/testing'

import { toPosts } from '../hooks/register'

test('maps the For You feed and drops posts without a title or url', async () => {
  const text = JSON.stringify({
    data: [
      {
        id: 'a', title: 'Skills Modern Devs Should Focus On', url: 'https://x.dev/a',
        summary: 'Judgment over typing speed.', commentsPermalink: 'https://daily.dev/posts/a',
        readTime: 5, numUpvotes: 24, numComments: 16, source: { name: 'CodeHead' },
      },
      { id: 'b', url: 'https://x.dev/b' },
    ],
  })
  const posts = toPosts(text)
  expect(posts.length).toBe(1)
  expect(posts[0]?.source).toBe('CodeHead')
  expect(posts[0]?.commentsUrl).toBe('https://daily.dev/posts/a')
  expect(toPosts('{}').length).toBe(0)
})
