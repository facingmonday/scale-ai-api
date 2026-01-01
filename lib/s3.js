const AWS = require("aws-sdk");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const mime = require("mime");

const spacesEndpoint = new AWS.Endpoint("nyc3.digitaloceanspaces.com");
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_API_KEY,
  secretAccessKey: process.env.SPACES_API_SECRET,
});

/**
 * Upload a file to S3
 * @param {Buffer} file - The file to upload
 * @param {Object} options - The options for the upload
 * @returns {Promise<Object>} - An object containing the URL and key of the uploaded file
 */
exports.upload = async function (file, options = {}) {
  const fileExtension = await sharp(file)
    .metadata()
    .then((metadata) => metadata.format || "jpg");

  const fileName = options.fileName || `${uuidv4()}.${fileExtension}`;

  const bucket =
    options.bucket || process.env.SPACES_BUCKET || "cityviewcms/garbage";

  const uploadParams = {
    Bucket: bucket,
    Key: fileName,
    Body: file,
    ACL: "public-read",
    ContentType: mime.getType(fileExtension),
  };

  const uploadResult = await s3.upload(uploadParams).promise();

  console.log("Uploaded file to S3", uploadResult.Location);

  return { url: uploadResult.Location, key: fileName, fileName };
};

/**
 * Delete a file from S3
 * @param {Object} options - The options for the delete
 * @returns {Promise<void>}
 */
exports.delete = async function ({ bucket, key }) {
  const deleteParams = {
    Bucket: bucket,
    Key: key,
  };

  try {
    await s3.deleteObject(deleteParams).promise();
    console.log(`Successfully deleted S3 object: ${key}`);
  } catch (error) {
    console.error(`Error deleting S3 object ${key}:`, error);
  }
};
