const fs = require('fs');
const path = require('path');

// Get all model files from the services directory
const servicesDir = path.join(__dirname, '../services');
const modelFiles = [];

// Recursively find all model files
function findModelFiles(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findModelFiles(filePath);
    } else if (file.endsWith('.model.js')) {
      modelFiles.push(filePath);
    }
  });
}

findModelFiles(servicesDir);

// Import all model files
modelFiles.forEach(file => {
  require(file);
});

module.exports = {}; 