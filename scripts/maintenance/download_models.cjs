const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, 'public', 'models');
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Ensuring models directory exists at:', MODELS_DIR);
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  for (const filename of files) {
    const dest = path.join(MODELS_DIR, filename);
    const url = `${BASE_URL}${filename}`;
    
    // Always overwrite to ensure complete files are downloaded after previous errors
    console.log(`[Downloading] ${filename}...`);
    try {
      await downloadFile(url, dest);
      console.log(`[Success] Saved ${filename}`);
    } catch (err) {
      console.error(`[Error] Failed to download ${filename}:`, err.message);
    }
  }
  console.log('Done downloading face-api models!');
}

main().catch(console.error);
