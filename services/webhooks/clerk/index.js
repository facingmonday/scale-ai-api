const express = require("express");
const { verifyWebhook } = require("./middleware");
const { handleClerkWebhook } = require("./clerk.controller");

const router = express.Router();

// Clerk webhook endpoint
// Note: This should be called BEFORE express.json() middleware
// to preserve raw body for signature verification

// Add a health check endpoint
router.get("/", (req, res) => {
  res.status(200).send("Clerk webhook endpoint OK");
});

router.post(
  "/",
  express.raw({ type: "application/json" }),
  verifyWebhook,
  handleClerkWebhook
);

module.exports = router;
