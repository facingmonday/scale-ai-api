const openai = require('.');

async function completion(prompt, options) {
  const formatResponse = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-1106',
    max_tokens: 2000,
    response_format: {
      type: 'json_object'
    },
    messages: [
      {
        content: "You are responsible for converting a news article into a data object in json. From the following article, create a title, subtitle, and author for the article. Create a fake funny name for the author based on the article. Convert the article into an array of paragraphs.",
        role: 'user',
      },
      {
        content: article,
        role: 'user'
      },
      {
        content: "The returned object should look like this: { title: 'title', subtitle: 'subtitle', author: 'author', paragraphs: ['paragraph1', 'paragraph2'], tags: ['tag1', 'tag2'] }",
        role: 'user',
      },

    ],
  });
  const articleObject = formatResponse.choices[0].message.content;

  return articleObject;
}

module.exports = completion;
