async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let idx = 0;
  const workers = new Array(Math.max(1, concurrency))
    .fill(null)
    .map(async () => {
      while (idx < items.length) {
        const current = idx++;
        results[current] = await mapper(items[current], current);
      }
    });
  await Promise.all(workers);
  return results;
}

module.exports = mapWithConcurrency;
