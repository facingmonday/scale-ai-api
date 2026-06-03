const {
  completion,
} = require("./lib");
const openai = require("../../lib/openai");
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
    const { prompt, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).send("Prompt is required");
    }
    const text = await completion(prompt, options);
    res.status(200).json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating news article");
  }
};

exports.generateImage = async function (req, res) {
  try {
    const { prompt, bucket = "images", size, quality = "low" } = req.body;
    const allowedQualities = new Set(["low", "medium", "high"]);
    const normalizedQuality =
      typeof quality === "string" ? quality.toLowerCase() : "low";
    const safeQuality = allowedQualities.has(normalizedQuality)
      ? normalizedQuality
      : "low";
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

    const startTime = Date.now();
    const newImageResponse = await openai.images.generate({
      model: "gpt-image-1-mini",
      prompt: prompt,
      n: 1,
      size: size,
      quality: safeQuality,
    });
    const image_b64_json = newImageResponse.data[0].b64_json;
    const endTime = Date.now();
    console.log(
      "Image generation took",
      (endTime - startTime) / 1000,
      "seconds"
    );

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
    res.status(200).send({
      image: fileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating news article");
  }
};
