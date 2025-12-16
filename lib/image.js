const AWS = require("aws-sdk");
const axios = require("axios");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const { upload } = require("./s3");
const nodeHtmlToImage = require("node-html-to-image");

/**
 * Convert image URL to data URL
 * @param {String} imageUrl - URL of the image
 * @returns {Promise<String|null>} - Data URL or null if conversion fails
 */
async function getImageAsDataUrl(imageUrl) {
  try {
    // Get the image data
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    // Get the content type
    const contentType = response.headers["content-type"];

    // Convert to base64
    const base64 = Buffer.from(response.data).toString("base64");

    // Create data URL
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error converting image to data URL:", error);
    return null;
  }
}

/**
 * Upload an image from a URL
 * @param {string} url - The URL of the image to upload
 * @param {Object} options - The options for the image upload
 * @returns {Promise<Object>} - The URL and metadata of the uploaded image
 */
async function uploadImageFromUrl(url, options = {}) {
  const filedata = await axios.get(url, {
    responseType: "arraybuffer",
  });

  const imageBuffer = await sharp(filedata.data)
    .resize({ width: options.width || 512 })
    .jpeg({ quality: options.quality || 50 })
    .toBuffer({ resolveWithObject: true });

  // Get the image metadata
  const metadata = await sharp(imageBuffer.data).metadata();

  const bucket = options.bucket || "cityviewcms/garbage";
  const fileName = options.fileName || `${uuidv4()}.jpg`;
  const { url: fileUrl } = await upload(imageBuffer.data, {
    bucket,
    fileName,
  });

  // make sure the fileUrl has http
  const finalUrl = !fileUrl.startsWith("http") ? "https://" + fileUrl : fileUrl;

  return {
    url: finalUrl,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: imageBuffer.data.length,
    mime: `image/${metadata.format}`,
    originalName: fileName,
    bucket,
    key: fileName,
  };
}

/**
 * Convert HTML to an image
 * @param {string} htmlContent - The HTML content to convert
 * @returns {Promise<Buffer>} - A buffer containing the image
 */
async function convertHtmlToImage(htmlContent) {
  return nodeHtmlToImage({
    html: htmlContent,
    quality: 100,
    type: "png",
    fullPage: true,
    waitUntil: "networkidle0",
  });
}

/**
 * Extract an image section from an image
 * @param {Buffer} image - The image to extract from
 * @param {number} startY - The y-coordinate to start the extraction
 * @param {number} width - The width of the section to extract
 * @param {number} height - The height of the section to extract
 * @returns {Promise<Buffer>} - A buffer containing the extracted image
 */
async function extractImageSection(image, startY, width, height) {
  return sharp(image)
    .extract({ left: 0, top: startY, width, height })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Find the closest image source to an event title
 * @param {string} eventTitle - The event title to search for
 * @param {Object} $ - The cheerio object to search within
 * @returns {string} - The URL of the closest image source
 */
function findClosestImageSource(eventTitle, $) {
  const titleNode = $(`*:contains(${eventTitle})`)
    .filter(function () {
      return (
        $(this).text().trim().toLowerCase() === eventTitle.trim().toLowerCase()
      );
    })
    .first();

  if (titleNode.length) {
    return findClosestImage(titleNode);
  }

  return "";
}

/**
 * Find the closest image source to an event title
 * @param {Object} node - The cheerio object to search within
 * @returns {string} - The URL of the closest image source
 */
function findClosestImage(node) {
  const img = node.find("img").first();
  if (img.length) {
    return img.attr("src") || "";
  }
  const parent = node.parent();
  return parent.length ? findClosestImage(parent) : "";
}

module.exports = {
  uploadImageFromUrl,
  convertHtmlToImage,
  extractImageSection,
  findClosestImageSource,
  getImageAsDataUrl,
};
