/**
 * Utils Service Routes
 * 
 * Provides utility endpoints for various helper functions (video transcription, event object creation, etc.).
 * All routes require org:admin role.
 * Mounted at: /v1/utils
 */
const express = require('express');
const controller = require('./utils.controller');
const { upload } = require('../../lib/spaces');
const router = express.Router();

const { requireAuth, checkRole } = require('../../middleware/auth');

router.get('/transcribe-video', requireAuth(), checkRole('org:admin'), controller.transcribeVideo);
router.post('/event-objects-from-json', requireAuth(), checkRole('org:admin'), controller.eventObjectsFromJSON);
router.post('/event-objects-from-text', requireAuth(), checkRole('org:admin'), controller.eventObjectsFromText);
router.post('/event-objects-from-image', requireAuth(), checkRole('org:admin'), upload('utils').single('file'), controller.eventObjectsFromImage);

module.exports = router;