const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
require('esbuild-register/dist/node').register({ supported: { 'dynamic-import': false } });
const root = path.resolve(__dirname, '../../apps/web/src');
const load = Module._load;
const originalFetch = global.fetch;
const originalWindow = global.window;
let challenge, outcome, calls, saved, rendered, failure, fontFailure;
global.window = { setTimeout };
global.fetch = async () => ({ ok: !fontFailure, arrayBuffer: async () => new Uint8Array([65, 66]).buffer });
const service = (name, result) => (...args) => {
  calls.push([name, ...args]);
  return failure === name ? Promise.reject(new Error('request failed')) : Promise.resolve({ data: result() });
};
Module._load = function(request, parent, isMain) {
  const name = request.startsWith('.') && parent ? path.resolve(path.dirname(parent.filename), request).replace(/\.(tsx?|jsx?)$/, '') : request;
  if (request.endsWith('.ttf?url')) return { __esModule: true, default: '/font.ttf' };
  if (name === path.join(root, 'services/challenge')) return { __esModule: true, default: { getById: service('challenge', () => challenge) } };
  if (name === path.join(root, 'services/outcome')) return { __esModule: true, default: { getOutcome: service('outcome', () => outcome) } };
  if (name === path.join(root, 'services/profileType')) return { __esModule: true, default: { getAll: service('profiles', () => []) } };
  if (name === path.join(root, 'services/variableDefinition')) return { __esModule: true, default: { getAll: service('definitions', () => []) } };
  if (name === path.join(root, 'utils/challengeResultsPdf')) return { createChallengeResultsPdf: (report) => {
    rendered = report;
    if (failure === 'renderer') throw new Error('render failed');
    return { save: async (...args) => { if (failure === 'save') throw new Error('save failed'); saved.push(args); } };
  } };
  return load.call(this, request, parent, isMain);
};
const { downloadChallengeResultsPdf } = require('../../apps/web/src/services/challengeResultsPdf.ts');
const classroom = { _id: 'class', name: 'Business', automationSettings: { timezone: 'America/Chicago' } };
test.beforeEach(() => {
  calls = []; saved = []; rendered = null; failure = null; fontFailure = false;
  challenge = { _id: 'challenge', classroomId: 'class', title: 'Fresh saved title', isClosed: true, automationStatus: 'processed', stats: { totalEnrolled: 2, submittedCount: 2, missingCount: 0, storeTypeStats: {} } };
  outcome = { notes: 'Fresh saved outcome', hiddenNotes: '' };
});
test.after(() => { Module._load = load; global.fetch = originalFetch; global.window = originalWindow; });

test('fetches saved data and initiates one PDF download', async () => {
  await downloadChallengeResultsPdf('challenge', classroom);
  assert.equal(rendered.title, 'Fresh saved title');
  assert.equal(rendered.outcomeNotes, 'Fresh saved outcome');
  assert.deepEqual(calls, [
    ['challenge', 'challenge', 'admin'], ['outcome', 'challenge'],
    ['profiles', 'admin', { classroomId: 'class' }], ['definitions', 'class', 'outcome', 'challenge'],
  ]);
  assert.equal(saved.length, 1);
  assert.match(saved[0][0], /^Fresh-saved-title-results-\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.deepEqual(saved[0][1], { returnPromise: true });
});

test('rechecks results and classroom after fetching instead of exporting stale page data', async () => {
  challenge.automationStatus = 'processing';
  await assert.rejects(downloadChallengeResultsPdf('challenge', classroom), /not available/);
  assert.equal(saved.length, 0);
  challenge.automationStatus = 'processed'; challenge.classroomId = 'other';
  await assert.rejects(downloadChallengeResultsPdf('challenge', classroom), /classroom changed/);
  assert.equal(saved.length, 0);
});

test('null outcome and missing debrief still produce a usable report', async () => {
  outcome = null;
  await downloadChallengeResultsPdf('challenge', classroom);
  assert.equal(rendered.outcomeNotes, 'No outcome notes are available.');
  assert.match(rendered.debrief[0].paragraphs[0], /No instructor debrief/);
  assert.equal(saved.length, 1);
});

test('request, font, rendering, and download failures propagate without success', async () => {
  for (const stage of ['challenge', 'outcome', 'profiles', 'definitions', 'renderer', 'save']) {
    failure = stage;
    await assert.rejects(downloadChallengeResultsPdf('challenge', classroom));
    assert.equal(saved.length, 0);
  }
  failure = null; fontFailure = true;
  await assert.rejects(downloadChallengeResultsPdf('challenge', classroom), /font/);
  assert.equal(saved.length, 0);
});
