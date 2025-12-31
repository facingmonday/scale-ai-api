const mongoose = require('mongoose'),
  baseSchema = require('../../lib/baseSchema');

const FolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder'
  },
  path: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['file', 'content', 'template', 'other'],
    default: 'file'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  strict: false
});

// Add the base schema fields
FolderSchema.add(baseSchema);

FolderSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

FolderSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Folder', FolderSchema);
