const AWS = require("aws-sdk");
const axios = require("axios");
const sharp = require("sharp");

const openai = require("../../../lib/openai");

async function generateImage(prompt, resize, options = {}) {
  const newImageResponse = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
    ...options,
  });
  const image_url = newImageResponse.data[0].url;
  console.log("Finished generating image", image_url);

  const filedata = await axios.get(image_url, { responseType: "arraybuffer" });
  let imageBuffer;
  if (resize && resize?.width && resize.width > 100 && resize.width <= 1024) {
    imageBuffer = await sharp(filedata.data)
      .resize({ width: resize.width })
      .jpeg({ quality: 50 })
      .toBuffer();
  } else {
    imageBuffer = filedata.data;
  }
  console.log("Finished resizing image");

  const spacesEndpoint = new AWS.Endpoint("nyc3.digitaloceanspaces.com"); // Replace with your Spaces endpoint
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_API_KEY,
    secretAccessKey: process.env.SPACES_API_SECRET,
  });
  const uploadParams = {
    Bucket: process.env.SPACES_BUCKET,
    Key: Date.now().toString() + "-" + "dall-e-3-image.jpg",
    Body: imageBuffer,
    ACL: "public-read",
    ContentType: "image/jpeg",
  };
  const uploadResult = await s3.upload(uploadParams).promise();
  let fileUrl = uploadResult.Location;

  // make sure the fileUrl has http
  if (!fileUrl.startsWith("http")) {
    fileUrl = "https://" + fileUrl;
  }
  return fileUrl;
}

module.exports = generateImage;
