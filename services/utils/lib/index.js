const openai = require('../../../lib/openai');

exports.isEvent = async function (text) {
  const isEventResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    response_format: {
      type: 'json_object'
    },
    messages: [
      {
        role: 'user',
        content: 'You are responsible for analyzing some text and identifying if it represents an event or an array of events. If it is an array of events return a status object { events: true }. If not, return { events: false}. falseconverting an object that represent events into an event object that matches the Events model.',

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
  const isEvent = JSON.parse(isEventResponse.choices[0].message.content);
  return isEvent;
}

exports.getTextFromImage = async function (image) {
  const aiResponse = await openai.chat.completions.create({
    model: "dall-e-3",
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: 'You are responsible for analyzing an image and returning all the text for the image in a structured format.',
      },
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
    ],
  });
  const textResponse = aiResponse.choices[0].message.content;
  return textResponse;
}

// Use openai to format json from text that is almost json or badly formatted json
exports.formatJSON = async function (text) {
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
  return json;
}