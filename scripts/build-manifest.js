const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mode = process.argv[2]; // 'dev' or 'prod'

const baseManifest = {
  "name": "Comment Summary ✨",
  "id": "1521063587587196294",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma", "figjam"],
  // "enablePrivatePluginApi": true,
  "documentAccess": "dynamic-page",
  "networkAccess": { 
    "allowedDomains": [
      "https://figma-comment-summary.onrender.com",
      "https://www.figma.com",
      "https://figma.com"
    ] 
  }
};

if (mode === 'dev') {
  // Add dev name suffix
  baseManifest.name += " (Dev)";
  
  // Add ngrok URL from environment variable
  const ngrokUrl = process.env.NGROK_URL || 'https://your-ngrok-url.ngrok-free.app';
  baseManifest.networkAccess.allowedDomains.push(ngrokUrl);
  
  console.log(`Building dev manifest with ngrok URL: ${ngrokUrl}`);
} else {
  console.log('Building production manifest');
}

// Write the manifest
fs.writeFileSync(
  path.join(__dirname, '..', 'manifest.json'),
  JSON.stringify(baseManifest, null, 2)
);

console.log(`Manifest generated for ${mode} mode`); 