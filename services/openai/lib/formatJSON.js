const openai = require('../../../lib/openai');

async function formatJSON(text) {
  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4000,
    response_format: {
      type: 'json_object'
    },
    messages: [
      {
        role: 'user',
        content: 'You are responsible for converting text that is almost json or badly formatted json into a json object.'
      },
      {
        role: 'user',
        content: text
      },
      {
        role: 'user',
        content: 'Begin json: '
      },
    ],
  });
  const json = JSON.parse(aiResponse.choices[0].message.content);

  // Sometimes json is nested in a random key or keys, so return the deepst value
  let deepValue = json;
  while (Object.keys(deepValue).length === 1) {
    deepValue = deepValue[Object.keys(deepValue)[0]];
  }
  return deepValue;
}

module.exports = formatJSON;