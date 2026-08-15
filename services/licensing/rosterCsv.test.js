const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCsvRows, parseRosterCsv } = require("./rosterCsv");

test("roster CSV parser", async (t) => {
  await t.test("keeps quoted multiline cells in the same roster row", () => {
    const csv = [
      "Student,Email Address,Program of Study,Last Name,First Name,Student ID",
      'Maramarie Abide,abide@uark.edu,"Exploring Undergraduate (WCOB)\n\nPre-Business (Undeclared)",Abide,Maramarie,300308048',
      'Ao Hara,ahara@uark.edu,Undergraduate ARSC Non-Degree,Hara,Ao,300421183',
    ].join("\r\n");

    assert.deepEqual(parseRosterCsv(csv), [
      {
        email: "abide@uark.edu",
        studentId: "300308048",
        firstName: "Maramarie",
        lastName: "Abide",
        section: "",
      },
      {
        email: "ahara@uark.edu",
        studentId: "300421183",
        firstName: "Ao",
        lastName: "Hara",
        section: "",
      },
    ]);
  });

  await t.test("supports escaped quotes and commas inside quoted cells", () => {
    const csv =
      'Email,Student ID,First Name,Last Name,Section\n' +
      'alex@example.edu,S123,Alex,Lee,"Section ""A, Honors"""';

    assert.deepEqual(parseRosterCsv(csv), [
      {
        email: "alex@example.edu",
        studentId: "S123",
        firstName: "Alex",
        lastName: "Lee",
        section: 'Section "A, Honors"',
      },
    ]);
  });

  await t.test("ignores blank records outside quoted fields", () => {
    assert.deepEqual(parseCsvRows("Email,Student ID\n\nuser@example.edu,123\n"), [
      ["Email", "Student ID"],
      ["user@example.edu", "123"],
    ]);
  });
});
