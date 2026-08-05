/**
 * Set OPENAI_API_KEY before models that transitively load lib/openai are required.
 */
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-key";
}
