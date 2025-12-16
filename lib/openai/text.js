const openai = require('.');

async function analyzeText(text, prompt, options = {}) {

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant that performs analysis on text to extract information.`
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "text", text: text }
        ]
      }
    ],
    max_tokens: 4000,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(completion.choices[0].message.content);
  return options?.dataType && result[options?.dataType] ? result[options?.dataType] : result[Object.keys(result)[0]];
}

module.exports = {
  analyzeText,
};