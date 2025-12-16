const openai = require('../../../lib/openai');
const formatJSON = require('./formatJSON');

async function analyzeImage(image, prompt, responseFormat) {
  const promptMessages = [
    ...(prompt ? [{
      "role": "user",
      "content": prompt
    }] : []),
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": image
          },
        },
      ],
    },
  ]
  const aiResponse = await openai.chat.completions.create({
    model: "dall-e-3",
    max_tokens: 4000,
    messages: promptMessages,
  });
  const textResponse = aiResponse.choices[0].message.content;
  if (responseFormat === "json") {
    const json = await formatJSON(textResponse);

    // Sometimes the JSON we need to return is nested in a random key or keys, so return the deepst value
    let deepValue = json;
    while (Object.keys(deepValue).length === 1) {
      deepValue = deepValue[Object.keys(deepValue)[0]];
    }
    return deepValue;
  }
  return textResponse;
}

module.exports = analyzeImage;