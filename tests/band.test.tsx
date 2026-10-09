import { expect, mock, test } from 'claude-code/testing'

const POST = {
  id: 'a', title: 'Skills Modern Devs Should Focus On', url: 'https://x.dev/a',
  summary: 'Judgment over typing speed.', source: 'CodeHead', readTime: 5,
  upvotes: 24, comments: 16, commentsUrl: 'https://daily.dev/posts/a', tags: ['career'],
}

test('band draws the cached post while Claude works', async ($, on) => {
  mock.clock(on, { now: 1000 })
  mock.store(on, { cache: { at: 0, posts: [POST], index: 0 } })
  on('command.register', async ($, e) => ({ value: { command: e.name } }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('ui.render', async () => null as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)

  const props = {
    hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 19 }, view: {},
  } as never
  const ui = await $.ui.mount({ plugin: 'dailydev-feed', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await ui.find({ type: 'Text', text: /Skills Modern Devs/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1\/1/ })).toBeDefined()
  expect(await ui.find({ key: 'next' })).toBeDefined()
  await ui.unmount()
})

test('feed is fetched on turn start when session start found no server', async ($, on) => {
  mock.clock(on, { now: 1000 })
  mock.store(on, {})
  let calls = 0
  on('mcp.call', async () => {
    calls++
    if (calls === 1) throw new Error('no tool "getFeedsForyou" on a server named "daily-dev"')
    const raw = { ...POST, numUpvotes: 24, numComments: 16, source: { name: 'CodeHead' }, commentsPermalink: POST.commentsUrl }
    return { value: { content: [{ type: 'text', text: JSON.stringify({ data: [raw] }) }], isError: false } } as never
  })
  on('command.register', async ($, e) => ({ value: { command: e.name } }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('turn.start', async ($, e) => ({ turnId: e.turnId }))
  on('ui.render', async () => null as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await new Promise(r => setTimeout(r, 0))

  const props = {
    hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 19 }, view: {},
  } as never
  const ui = await $.ui.mount({ plugin: 'dailydev-feed', surface: 'terminal', component: 'AbovePrompt', props })
  expect(calls).toBe(2)
  expect(await ui.find({ type: 'Text', text: /Skills Modern Devs/ })).toBeDefined()
  await ui.unmount()
})
