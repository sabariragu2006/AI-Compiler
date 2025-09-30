const { getDB } = require('../db');

const COLLECTION_NAME = 'files';

// ---------------- Save / Update ----------------
const saveFile = async (req, res, next) => {
  try {
    const db = getDB();
    const { name, content } = req.body;

    if (!name || content === undefined) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.updateOne(
      { name },
      { $set: { content, updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({
      success: true,
      message: result.upsertedCount ? 'File created' : 'File updated',
    });
  } catch (err) {
    next(err);
  }
};

// ---------------- Get All ----------------
const getFiles = async (req, res, next) => {
  try {
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);
    const files = await collection
      .find({}, { projection: { _id: 0, name: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .toArray();

    res.json(files);
  } catch (err) {
    next(err);
  }
};

// ---------------- Get One ----------------
const getFile = async (req, res, next) => {
  try {
    const db = getDB();
    const { name } = req.params;
    const collection = db.collection(COLLECTION_NAME);

    const file = await collection.findOne({ name }, { projection: { _id: 0 } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.json(file);
  } catch (err) {
    next(err);
  }
};

// ---------------- Delete ----------------
const deleteFile = async (req, res, next) => {
  try {
    const db = getDB();
    const { name } = req.params;
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.deleteOne({ name });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    next(err);
  }
};

// ---------------- Preview HTML ----------------
const previewFile = async (req, res, next) => {
  try {
    const { name } = req.params;
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    const file = await collection.findOne({ name });
    if (!file) return res.status(404).send('File not found');

    if (!name.endsWith('.html')) {
      return res.status(400).send('Preview only works for HTML files');
    }

    res.type('html');
    res.send(file.content);
  } catch (err) {
    next(err);
  }
};

// ---------------- Serve Asset ----------------
const serveAsset = async (req, res, next) => {
  try {
    const { name } = req.params;
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    const file = await collection.findOne({ name });
    if (!file) return res.status(404).send('Asset not found');

    // Infer content type
    if (name.endsWith('.css')) res.type('css');
    else if (name.endsWith('.js')) res.type('application/javascript');
    else if (name.endsWith('.png')) res.type('png');
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) res.type('jpeg');
    else if (name.endsWith('.svg')) res.type('svg');
    else res.type('text/plain');

    res.send(file.content);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  saveFile,
  getFiles,
  getFile,
  deleteFile,
  previewFile,
  serveAsset,
};
