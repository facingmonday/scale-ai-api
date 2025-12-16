const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");

// Update the endpoint configuration
const spacesEndpoint = new AWS.Endpoint("https://nyc3.digitaloceanspaces.com");

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_API_KEY,
  secretAccessKey: process.env.SPACES_API_SECRET,
});

exports.upload = (bucket = "files") =>
  multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.SPACES_BUCKET,
      acl: "public-read",
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: function (req, file, cb) {
        // Get organization ID from the request
        const organizationId = req.organization._id.toString();

        // Get folder path if provided
        const folder = req.body.folder
          ? req.body.folder.replace(/\//g, "")
          : "";

        // Build the key path: organizations/{orgId}/{bucket}/{folder?}/{filename}
        const keyPath = folder
          ? `organizations/${organizationId}/${bucket}/${folder}/${Date.now()}-${
              file.originalname
            }`
          : `organizations/${organizationId}/${bucket}/${Date.now()}-${
              file.originalname
            }`;

        // Store the bucket and key in the request for later use
        req.fileData = {
          key: keyPath,
          contentType: file.mimetype,
          bucket: process.env.SPACES_BUCKET,
        };

        cb(null, keyPath);
      },
    }),
  });

exports.deleteFile = async function (bucket, key) {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  return new Promise((resolve, reject) => {
    s3.deleteObject(params, function (err, data) {
      if (err) {
        console.error(err, err.stack);
        reject(err);
      } else {
        console.log("File deleted successfully:", key);
        resolve(data);
      }
    });
  });
};
