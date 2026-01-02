const {
  analyzeImage,
  completion,
  generateImage,
  transcribeAudio,
} = require("./lib");
const { deleteFile } = require("../../lib/spaces");
const openai = require("../../lib/openai");
const axios = require("axios");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");

const spacesEndpoint = new AWS.Endpoint("nyc3.digitaloceanspaces.com");
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_API_KEY,
  secretAccessKey: process.env.SPACES_API_SECRET,
});

exports.completion = async function (req, res) {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).send("Prompt is required");
    }
    const text = await completion(prompt);
    res.status(200).json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating news article");
  }
};

exports.generateImage = async function (req, res) {
  try {
    const { prompt, bucket = "images", size } = req.body;
    // Check if prompt exists
    if (!prompt && !size) {
      return res
        .status(400)
        .send("Invalid request. prompt and size are required");
    }

    // Check if prompt is a valid string
    if (typeof prompt !== "string") {
      return res.status(400).send("Invalid prompt");
    }

    console.log("Generating image from prompt");
    const newImageResponse = await openai.images.generate({
      model: "gpt-image-1-mini",
      prompt: prompt,
      n: 1,
      size: size,
    });
    const image_b64_json = newImageResponse.data[0].b64_json;
    console.log("Finished generating image from prompt", image_b64_json);

    // Upload the image to S3
    const imageBuffer = Buffer.from(image_b64_json, "base64");
    const imageKey = `image/${uuidv4()}.jpg`;

    const uploadParams = {
      Bucket: process.env.SPACES_BUCKET,
      Key: imageKey,
      Body: imageBuffer,
      ContentType: "image/jpeg",
      ACL: "public-read",
    };
    const uploadResponse = await s3.upload(uploadParams).promise();
    const fileUrl = uploadResponse.Location;
    console.log("Finished uploading image", fileUrl);
    res.status(200).send({
      image: fileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating news article");
  }
};

exports.analyzeImage = async function (req, res) {
  try {
    const { prompt = "Summarize this image", responseFormat = "text" } =
      req.body;
    const { file } = req;

    if (!file) {
      return res.status(400).send("Image is required");
    }
    const imageUrl = file.location;
    if (!imageUrl) {
      return res.status(400).send("Image URL is required");
    }
    const image =
      !imageUrl.indexOf("http") > -1 ? `https://${imageUrl}` : imageUrl;

    const data = await analyzeImage(image, prompt, responseFormat);

    res.status(200).json({ data });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send(error?.message ? error.message : "Error analyzing image");
  }
};

// Function to transcribe audio using open ai
exports.transcribeAudio = async function (req, res) {
  try {
    const { file } = req;

    if (!file) {
      return res.status(400).send("Audio is required");
    }
    const audioUrl = file.location;
    if (!audioUrl) {
      return res.status(400).send("Audio URL is required");
    }
    const audio =
      audioUrl.indexOf("http") < 0 ? `https://${audioUrl}` : audioUrl;

    const text = await transcribeAudio(audio);

    if (!text) {
      throw new Error("No text returned");
    }

    // Delete the audio file from storage
    try {
      await deleteFile(process.env.SPACES_BUCKET, file.key);
    } catch (error) {
      console.error("Error deleting audio file", error);
    }

    res.status(200).json({ text });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send(error?.message ? error.message : "Error transcribing audio");
  }
};
