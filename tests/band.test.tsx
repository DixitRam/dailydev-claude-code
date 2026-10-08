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
