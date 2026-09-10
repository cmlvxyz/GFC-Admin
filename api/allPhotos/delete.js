// api/allPhotos/delete.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(process.cwd(), 'data', 'data.json');

// Helper: basahin ang data.json
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

// Helper: isulat pabalik sa data.json
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = async function handler(req, res) {
  // CORS headers (kung kailangan)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Tanggapin lamang ang DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Vercel automatically parses JSON body kapag Content-Type: application/json
    const { albumIndex, photoIndex } = req.body || {};

    // Validate
    if (typeof albumIndex !== 'number' || typeof photoIndex !== 'number') {
      return res.status(400).json({
        message: 'albumIndex and photoIndex must be numbers',
      });
    }

    // Basahin ang data
    const data = readData();

    // Hanapin ang "allPhotos" array
    // ⚠️ IMPORTANTE: I-adjust ito base sa totoong structure ng data.json mo!
    // Ang common structure ay: data.allPhotos = [ { albumName, photos: [...] }, ... ]
    if (!Array.isArray(data.allPhotos)) {
      return res.status(500).json({
        message: 'data.allPhotos is not an array. Check data.json structure.',
      });
    }

    // Validate albumIndex
    if (albumIndex < 0 || albumIndex >= data.allPhotos.length) {
      return res.status(404).json({
        message: 'Album not found',
      });
    }

    const album = data.allPhotos[albumIndex];
    if (!Array.isArray(album.photos)) {
      return res.status(500).json({
        message: 'Album has no photos array',
      });
    }

    // Validate photoIndex
    if (photoIndex < 0 || photoIndex >= album.photos.length) {
      return res.status(404).json({
        message: 'Photo not found in this album',
      });
    }

    // Burahin ang photo sa array
    const deletedPhoto = album.photos.splice(photoIndex, 1)[0];

    // Isulat pabalik sa data.json
    writeData(data);

    // Success
    return res.status(200).json({
      message: 'Photo deleted successfully',
      albumIndex,
      photoIndex,
      deletedPhoto,
    });

  } catch (error) {
    console.error('Error deleting photo:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};