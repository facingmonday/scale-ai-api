const openai = require('../../lib/openai');
const axios = require('axios');
const YoutubeTranscript = require('youtube-transcript');
const { isEvent, formatJSON } = require('./lib');
const { get } = require('lodash');

exports.slugify = (text) => {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-");
}

exports.transcribeVideo = async function (req, res) {
  try {
    console.log('Transcribing video');
    const {
      videoId,
      language = 'en'
    } = req.body;
    if (!videoId) {
      return res.status(400).send('Video ID is required');
    }
    const transcript = await YoutubeTranscript.fetchTranscript(`https://www.youtube.com/watch?v=${videoId}`, { lang: language });
    console.log('Finished transcribing video');
    res.status(200).json({ transcript: transcript.map((item) => item.text).join(' ') });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error transcribing video');
  }
}

exports.eventObjectsFromJSON = async function (req, res) {
  try {
    const { url, key } = req.body;
    if (!url) {
      return res.status(400).send('URL is required');
    }

    // Get JSON from URL
    const { data } = await axios.get(url);


    let rawEvents;
    if (key) {
      rawEvents = get(data, key);
    } else {
      rawEvents = data;
    }
    if (!Array.isArray(rawEvents)) {
      return res.status(400).send('Data must be an array');
    }

    const events = [];

    for (const event of rawEvents) {
      // Use openai to generate events that match the Events model from the response data
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2000,
        response_format: {
          type: 'json_object'
        },
        messages: [
          {
            role: 'user',
            content: 'You are responsible for converting an object that represent an event into an event object that matches the Events model.',

          },
          {
            'role': 'user',
            content: 'The Events model has a title, start which is a javascript datetime, end which is a javascript datetime, image which is a url of an image, description, price, and link.'
          },
          {
            role: 'user',
            content: "If you are unable to find the data for a given field, make it an empty string."
          },
          {
            role: 'user',
            content: "Example json: { title: 'Event 1', start: '2022-01-01T00:00:00', end: '2022-01-01T00:00:00', image: 'https://example.com/image.jpg', description: 'This is an event', price: '', link: 'https://example.com' }"
          },
          {
            role: 'user',
            content: JSON.stringify(event),
          },
          {
            role: 'user',
            content: 'Begin json: '
          }
        ],
      });
      const eventObject = JSON.parse(aiResponse.choices[0].message.content);
      events.push(eventObject);
    }
    res.status(200).json(events);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
}

// Analyze the given text and return an event object or list of events
exports.eventObjectsFromText = async function (req, res) {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).send('Text is required');
    }

    const textIsEvent = await isEvent(text);

    if (!textIsEvent.events) {
      return res.status(200).json({ events: false });
    }

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      response_format: {
        type: 'json_object'
      },
      messages: [
        {
          role: 'user',
          content: 'You are responible for analyzing text and determining if it represents an event or multiple events and converting them to an object that represents the Events model.',
        },
        {
          'role': 'user',
          content: 'The Events model has a title, start which is a javascript datetime, end which is a javascript datetime, image which is a url of an image, description, price, and link.'
        },
        {
          role: 'user',
          content: "If you are unable to find the data for a given field, make it an empty string."
        },
        {
          role: 'user',
          content: "Always return an array even if there is just one. Example json: [{ title: 'Event 1', start: '2022-01-01T00:00:00', end: '2022-01-01T00:00:00', image: 'https://example.com/image.jpg', description: 'This is an event', price: '', link: 'https://example.com' }]"
        },
        {
          role: 'user',
          content: 'Begin json: '
        },
        {
          role: 'user',
          content: text
        }
      ],
    });
    const eventObject = JSON.parse(aiResponse.choices[0].message.content);
    res.status(200).json({ event: eventObject });
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
}

// Analyze the given image file and return an event object or list of events
exports.eventObjectsFromImage = async function (req, res) {
  try {
    const { prompt, metadata } = req.body;
    const imageUrl = req.file.location;
    if (!imageUrl) {
      return res.status(400).send('Image URL is required');
    }
    const image = (imageUrl.indexOf('http') < 0) ? `https://${imageUrl}` : imageUrl;

    const messages = [
      {
        role: 'user',
        content: 'You will be given an image which is a poster for an event or multiple events. You are responsible for creating an array of event objects from the image.',
      },
      {
        role: 'user',
        content: "The Events model has a title, start which is a javascript datetime, end which is a javascript datetime, image which is a url of an image, description, price, and link. If you are unable to find the data for a given field, make it an empty string."
      },
      {
        role: 'user',
        content: "Always return an array even if there is just one. Example json: [{ title: 'Event 1', start: '2022-01-01T00:00:00', end: '2022-01-01T00:00:00', image: 'https://example.com/image.jpg', description: 'This is an event', price: '', link: 'https://example.com' }]"
      },
      ...(prompt ? [{
        role: 'user',
        content: prompt
      }] : []),
      ...(metadata ? [{
        role: 'user',
        content: "Use the following metadata to fill in empty fields: " + metadata
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
      {
        role: 'user',
        content: 'Begin json: '
      },
    ];
    const somewhatJSONResponse = await openai.chat.completions.create({
      model: "dall-e-3",
      max_tokens: 4000,
      messages,
    });
    const somewhatJSON = somewhatJSONResponse.choices[0].message.content;

    const events = await formatJSON(somewhatJSON);

    let deepValue = events;
    while (Object.keys(deepValue).length === 1) {
      deepValue = deepValue[Object.keys(deepValue)[0]];
    }

    // Add the image to each event in deepValue as thumbnail
    if (Array.isArray(deepValue)) {
      for (const event of deepValue) {
        event.defaultImage = image;
      }
    }

    res.status(200).json(deepValue);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
}