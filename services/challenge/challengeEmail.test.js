const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("./lib/challengeEmailService");
const { renderReactEmail } = require("../../lib/emails/reactRenderer");

test("reminder dates use classroom timezone, rejecting past, invalid, missing and ambiguous DST times", () => {
  const now = new Date("2026-01-01T00:00Z");
  assert.equal(
    service.parseTime("2026-07-01T09:00", "America/Chicago", now).toISOString(),
    "2026-07-01T14:00:00.000Z",
  );
  assert.equal(
    service.parseTime("2026-02-01T09:00", "America/Chicago", now).toISOString(),
    "2026-02-01T15:00:00.000Z",
  );
  for (const value of [
    "2026-03-08T02:30",
    "2026-11-01T01:30",
    "2025-12-01T09:00",
    "2026-02-31T10:00",
    "bad",
    "2026-01-02T10:00Z",
  ]) {
    assert.throws(() => service.parseTime(value, "America/Chicago", now), {
      statusCode: 400,
    });
  }
});
test("availability matches the submission lock and scheduled opening rules", () => {
  const open = { isPublished: true };
  assert.equal(service.availability(open, "missing"), null);
  for (const challenge of [
    null,
    {},
    { ...open, isClosed: true },
    { ...open, publishAt: "2099-01-01" },
  ]) {
    assert.ok(service.availability(challenge, "missing"));
  }
  assert.ok(
    service.availability({ ...open, isLockedForStudents: true }, "missing"),
  );
  assert.equal(
    service.availability({ ...open, isLockedForStudents: true }, "all"),
    null,
  );
  // A passed deadline alone does not close instructor-controlled submissions.
  assert.equal(
    service.availability(
      { ...open, submissionDeadlineAt: "2020-01-01", automationMode: "MANUAL" },
      "missing",
    ),
    null,
  );
});
test("standard email templates render escaped titles, deadline, classroom and challenge link", async () => {
  for (const audience of ["all", "missing"]) {
    const email = service.content(
      {
        title: "Pricing <script>",
        classroomId: "class1",
        _id: "challenge1",
        submissionDeadlineAt: "2026-09-08T22:00:00Z",
      },
      {
        name: "Strategy Class",
        automationSettings: { timezone: "America/Chicago" },
      },
      audience,
    );
    const rendered = await renderReactEmail(
      email.templateSlug,
      email.templateData,
    );
    assert.ok(rendered.html.includes("Pricing &lt;script&gt;"));
    assert.ok(rendered.text.includes("Strategy Class"));
    assert.ok(rendered.text.includes("5:00 PM"));
    assert.ok(rendered.html.includes("/class/class1/challenge/challenge1"));
    assert.equal(
      rendered.text.includes("not submitted"),
      audience === "missing",
    );
  }
});
