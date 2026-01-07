const openai = require("../../../lib/openai");

async function completion(message, options = {}) {
  const _options = {
    model: options.model || "gpt-3.5-turbo",
    // max_tokens: 2000,
    ...options,
  };
  const startTime = Date.now();
  console.log(
    "OpenAI completion started at:",
    new Date(startTime).toISOString()
  );
  const response = await openai.chat.completions.create({
    ..._options,
    messages: [
      {
        role: "user",
        content: message,
      },
    ],
  });
  const endTime = Date.now();
  console.log(
    "OpenAI completion completed at:",
    new Date(endTime).toISOString()
  );
  console.log(
    "OpenAI completion took:",
    (endTime - startTime) / 1000,
    "seconds"
  );
  return response.choices[0].message.content;
}

module.exports = completion;
