const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) global[key] = dom.window[key];
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup, act } = require('@testing-library/react');
require('esbuild-register/dist/node').register({ jsx: 'automatic', supported: { 'dynamic-import': false } });
const root = path.resolve(__dirname, '../../apps/web/src');
const load = Module._load;
let messages = [], calls = [], resolveDownload, rejectDownload;
Module._load = function(request, parent, isMain) {
  const name = request.startsWith('.') && parent ? path.resolve(path.dirname(parent.filename), request).replace(/\.(tsx?|jsx?)$/, '') : request;
  if (name === path.join(root, 'context/GlobalContext')) return { useGlobalContext: () => ({ showToast: (...args) => messages.push(args) }) };
  if (name === path.join(root, 'services/challengeResultsPdf')) return {
    downloadChallengeResultsPdf: (...args) => { calls.push(args); return new Promise((resolve, reject) => { resolveDownload = resolve; rejectDownload = reject; }); },
  };
  return load.call(this, request, parent, isMain);
};
const Button = require('../../apps/web/src/components/DownloadChallengeResultsButton.tsx').default;
const challenge = { _id: 'challenge', stats: {}, isClosed: true, automationStatus: 'processed' };
const classroom = { _id: 'class' };
test.beforeEach(() => { messages = []; calls = []; });
test.afterEach(cleanup);
test.after(() => { Module._load = load; dom.window.close(); });

test('spinner is immediate, blocks duplicate clicks, and success waits for completion', async () => {
  render(React.createElement(Button, { challenge, classroom }));
  const button = screen.getByRole('button', { name: 'Download results PDF' });
  fireEvent.click(button);
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.match(button.textContent, /Preparing PDF/);
  assert.ok(button.querySelector('.pi-spin.pi-spinner'));
  fireEvent.click(button);
  await waitFor(() => assert.equal(calls.length, 1));
  assert.deepEqual(calls[0], ['challenge', classroom]);
  assert.equal(messages.length, 0);
  await act(async () => resolveDownload());
  assert.deepEqual(messages, [['Results PDF downloaded.', 'success']]);
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute('aria-busy'), 'false');
  assert.equal(button.querySelector('.pi-spinner'), null);
});

test('failure restores button, shows no success, and permits retry', async () => {
  render(React.createElement(Button, { challenge, classroom }));
  const button = screen.getByRole('button', { name: 'Download results PDF' });
  fireEvent.click(button);
  await waitFor(() => assert.equal(calls.length, 1));
  const oldError = console.error;
  console.error = () => {};
  try { await act(async () => rejectDownload(new Error('request failed'))); }
  finally { console.error = oldError; }
  assert.equal(button.disabled, false);
  assert.deepEqual(messages, [['Couldn’t download results PDF. Please try again.', 'error']]);
  fireEvent.click(button);
  await waitFor(() => assert.equal(calls.length, 2));
  await act(async () => resolveDownload());
  assert.equal(messages.filter(([, kind]) => kind === 'success').length, 1);
});

test('button is disabled before completed statistics exist', () => {
  render(React.createElement(Button, { challenge: { ...challenge, stats: undefined }, classroom }));
  const button = screen.getByRole('button', { name: 'Download results PDF' });
  assert.equal(button.disabled, true);
  fireEvent.click(button);
  assert.equal(calls.length, 0);
});
