const fs = require('fs');
const path = require('path');

const notesDir = path.join(__dirname, 'note');

const EXPIRATION_OPTIONS = {
  '24h': 24 * 60 * 60 * 1000,
  '1d': 1 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '10d': 10 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  'never': null
};

function getNoteMetaPath(uuid) {
  return path.join(notesDir, `${uuid}.meta.json`);
}

function getNoteDataPath(uuid) {
  return path.join(notesDir, `${uuid}.txt`);
}

function getNoteMetadata(uuid) {
  const metaPath = getNoteMetaPath(uuid);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveNoteMetadata(uuid, metadata) {
  const metaPath = getNoteMetaPath(uuid);
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
}

function parseExpiration(expStr) {
  if (!expStr || expStr === 'never') return null;
  const ms = EXPIRATION_OPTIONS[expStr];
  if (ms === undefined) return null;
  return Date.now() + ms;
}

module.exports = {
  notesDir,
  EXPIRATION_OPTIONS,
  getNoteMetaPath,
  getNoteDataPath,
  getNoteMetadata,
  saveNoteMetadata,
  parseExpiration
};