const openai = require('.');

/**
 * Generate a voice from text
 * @param {string} text - The text to generate a voice from
 * @returns {Promise<string>} - The URL of the generated voice
 */
async function generateVoiceFromText(text) {
  const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    // Randomly select a voice
    voice: voices[Math.floor(Math.random() * voices.length)],
    input: text
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());

  const spacesEndpoint = new AWS.Endpoint("nyc3.digitaloceanspaces.com");
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_API_KEY,
    secretAccessKey: process.env.SPACES_API_SECRET,
  });

  const uploadParams = {
    Bucket: 'kikits/news',
    Key: Date.now().toString() + '.mp3',
    Body: buffer,
    ACL: 'public-read',
    ContentType: 'audio/mpeg',
  };

  const uploadResult = await s3.upload(uploadParams).promise();
  const fileUrl = uploadResult.Location;
  return fileUrl;
}

module.exports = {
  generateVoiceFromText,
};