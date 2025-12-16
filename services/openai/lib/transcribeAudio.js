const axios = require('axios');
const FormData = require('form-data'); // Ensure you have form-data installed

async function transcribeAudio(fileUrl, options = {}) {
  if (!fileUrl || !fileUrl.startsWith('http')) {
    throw new Error('A valid file URL is required');
  }

  // Download the file
  const response = await axios({
    url: fileUrl,
    method: 'GET',
    responseType: 'arraybuffer',
  });

  // Prepare the form data with the file and options
  const formData = new FormData();
  formData.append('file', Buffer.from(response.data), {
    filename: 'audio.mp3', // Adjust the filename as needed
    contentType: 'audio/mpeg', // Adjust the content type as needed
  });
  formData.append('model', 'whisper-1');
  for (const [key, value] of Object.entries(options)) {
    formData.append(key, value);
  }

  // Make the API request to OpenAI
  const transcriptionResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
    headers: {
      ...formData.getHeaders(),
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // Replace with your actual API key
    },
  });

  return transcriptionResponse.data.text;
}

module.exports = transcribeAudio;
