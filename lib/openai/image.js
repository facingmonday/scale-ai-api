const openai = require('.');

async function analyzeImage(imageUrl, prompt, options = {}) {

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant that performs OCR-like analysis on images to extract visible ${options.type || 'data'} information.`
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high"
            }
          }
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
  analyzeImage,
};
