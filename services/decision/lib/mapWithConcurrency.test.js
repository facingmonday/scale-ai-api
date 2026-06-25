const test = require("node:test");
const assert = require("node:assert/strict");
const mapWithConcurrency = require("./mapWithConcurrency");

test("mapWithConcurrency", async (t) => {
  await t.test("should process all items and return their mapped values", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (item) => {
      return item * 10;
    });
    assert.deepEqual(results, [10, 20, 30, 40, 50]);
  });

  await t.test("should enforce concurrency limits", async () => {
    const items = [1, 2, 3, 4];
    let maxRunning = 0;
    let currentlyRunning = 0;

    await mapWithConcurrency(items, 2, async (item) => {
      currentlyRunning++;
      maxRunning = Math.max(maxRunning, currentlyRunning);
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentlyRunning--;
      return item;
    });

    assert.strictEqual(maxRunning <= 2, true);
  });
});
