const openai = require("../../../lib/openai");

async function completion(message, options = {}) {
  const _options = {
    model: options.model || "gpt-3.5-turbo",
    // max_tokens: 2000,
    ...options,
  };
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
  
  return response.choices[0].message.content;
}

module.exports = completion;
