const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('esbuild-register/dist/node').register();
const { buildChallengeResultsReport, canDownloadChallengeResults } = require('../../apps/web/src/utils/challengeResultsReport.ts');
const { createChallengeResultsPdf } = require('../../apps/web/src/utils/challengeResultsPdf.ts');

function fixture() {
  const metrics = ['revenue', 'margin', 'sales', 'stock', 'costs', 'missing'].map((key, i) => ({
    key, label: key, dataType: 'number', isActive: true, sortOrder: i,
    format: i === 0 ? 'currency' : i === 1 ? 'percent' : 'count',
  }));
  return {
    challenge: {
      _id: 'challenge', classroomId: 'class', title: 'Café: Busy Week',
      description: 'Prepare for the café’s busiest week.', isClosed: true, automationStatus: 'processed',
      stats: {
        totalEnrolled: 20, submittedCount: 18, missingCount: 2, metricDefinitions: metrics,
        decisions: [{ userId: { firstName: 'PRIVATE-STUDENT' } }], missingSubmissions: ['PRIVATE-EMAIL'],
        storeTypeStats: {
          cafe: { count: 18, totals: { revenue: 1200.5, margin: 0.25, sales: 0 }, averages: { revenue: 60, margin: 0, sales: 0 },
            winners: [{ userId: 'PRIVATE-WINNER' }], losers: [{ userId: 'PRIVATE-LOSER' }] },
          'profile-id': { count: 0, totals: {}, averages: {} },
        },
      },
      teacherDebrief: { status: 'completed', summary: 'Demand exceeded expectations.',
        discussionQuestions: ['How could you prepare for higher demand?'],
        profileTypeSummaries: [{ label: 'Café', participantCount: 18, summary: 'Strong sales.', strengths: ['Staffing'], risks: ['Stock'], recommendedFocus: ['Forecast demand'] }],
      },
    },
    classroom: { _id: 'class', name: 'Business Simulation', automationSettings: { timezone: 'America/Chicago' } },
    outcome: { notes: 'Sunny weather increased traffic.', hiddenNotes: 'Discuss preparation.', variables: { temperature: 0, open: false, legacy: 'Saved legacy value' } },
    outcomeDefinitions: [
      { key: 'temperature', label: 'Temperature', isActive: true },
      { key: 'open', label: 'Open', isActive: true },
      { key: 'missing', label: 'Unset value', isActive: true, defaultValue: 999 },
    ],
    profileTypes: [{ _id: 'profile-id', key: 'cafe', label: 'Café' }],
    now: new Date('2026-10-15T02:00:00Z'),
  };
}
exports.fixture = fixture;

test('summary uses complete aggregate metrics and excludes individual records', () => {
  const report = buildChallengeResultsReport(fixture());
  assert.equal(report.profiles[0].metrics.length, 6);
  assert.deepEqual(report.profiles[0].metrics[0], ['revenue', '$1,200.50', '$60.00']);
  assert.deepEqual(report.profiles[0].metrics[1], ['margin', '25.0%', '0.0%']);
  assert.deepEqual(report.profiles[0].metrics[2], ['sales', '0', '0']);
  assert.deepEqual(report.profiles[0].metrics[5], ['missing', '—', '—']);
  assert.equal(report.profiles[1].label, 'Café');
  assert.deepEqual(report.outcomeVariables, [['Temperature', '0'], ['Open', 'No'], ['Unset value', '—'], ['legacy', 'Saved legacy value']]);
  assert.equal(report.filename, 'Cafe-Busy-Week-results-2026-10-14.pdf');
  assert.match(report.generatedAt, /America\/Chicago/);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE-|winners|losers|decisions|missingSubmissions/);
  assert.ok(report.debrief.some(section => section.title === 'Discussion questions'));
});

test('incomplete or recalculating results cannot be exported', () => {
  for (const patch of [{ stats: undefined }, { automationStatus: 'processing' }, { isClosed: false }, { processingRun: { preparing: true } }]) {
    const input = fixture(); Object.assign(input.challenge, patch);
    assert.equal(canDownloadChallengeResults(input.challenge), false);
    assert.throws(() => buildChallengeResultsReport(input), /not available/);
  }
});

test('missing outcome/debrief, inactive metrics, and invalid timezone have safe representations', () => {
  const input = fixture();
  input.outcome = null;
  input.challenge.teacherDebrief = { status: 'failed' };
  input.classroom.automationSettings.timezone = 'invalid-zone';
  input.challenge.stats.metricDefinitions[0].isActive = false;
  const report = buildChallengeResultsReport(input);
  assert.equal(report.profiles[0].metrics.length, 5);
  assert.match(report.generatedAt, /UTC/);
  assert.equal(report.instructorNotes, '');
  assert.match(report.debrief[0].paragraphs[0], /could not be generated/);
  assert.ok(report.outcomeVariables.every(row => row[1] === '—'));
});

test('renders a real multipage PDF with embedded fonts', () => {
  const input = fixture();
  input.challenge.teacherDebrief.summary = 'Évaluation: demand, staffing, and margins. '.repeat(400);
  const report = buildChallengeResultsReport(input);
  const dir = path.resolve(__dirname, '../../apps/web/src/assets/fonts');
  const doc = createChallengeResultsPdf(report, {
    regular: fs.readFileSync(path.join(dir, 'DejaVuSans.ttf')).toString('base64'),
    bold: fs.readFileSync(path.join(dir, 'DejaVuSans-Bold.ttf')).toString('base64'),
  });
  assert.ok(doc.getNumberOfPages() > 2);
  assert.match(doc.output(), /^%PDF/);
  assert.match(doc.output(), /FontFile2/);
});
