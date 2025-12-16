const openai = require('../../../lib/openai');

async function completion(message, options = {}) {
  const _options = {
    model: "gpt-4o",
    max_tokens: 2000,
    ...options
  };
  const response = await openai.chat.completions.create({
    ..._options,
    messages: [
      {
        role: 'user',
        content: message
      }
    ]
  });
  return response.choices[0].message.content;
}

module.exports = completion;