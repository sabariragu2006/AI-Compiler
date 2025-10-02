// controllers/files.js
const { getDB } = require('../db');

const COLLECTION_NAME = 'files';

const normalizePath = (path = '') => {
  return path.replace(/^\/+|\/+$/g, ''); // remove leading/trailing slashes
};

const saveFile = async (req, res, next) => {
  try {
    const db = getDB();
    const { name, content = '', path = '', type = 'file' } = req.body;

    if (!name || (type === 'file' && content === undefined)) {
      return res.status(400).json({ error: 'Name and content are required for files' });
    }

    const collection = db.collection(COLLECTION_NAME);

    // Normalize parent path
    const cleanPath = normalizePath(path);

    // Store fullPath consistently
    const fullPath = cleanPath ? `${cleanPath}/${name}` : name;

    const result = await collection.updateOne(
      { path: fullPath }, // unique match by normalized path
      {
        $set: {
          name,
          path: fullPath,
          content: type === 'file' ? content : null,
          type,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      fullPath,
      extension: type === 'file' && name.includes('.') ? name.split('.').pop() : '',
      message: result.upsertedCount
        ? type === 'file'
          ? 'File created'
          : 'Folder created'
        : type === 'file'
        ? 'File updated'
        : 'Folder updated',
    });
  } catch (err) {
    next(err);
  }
};


// ---------------- Get All Files & Folders (Immediate Children Only) ----------------
const getFiles = async (req, res, next) => {
  try {
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    // Get ALL files and folders (no path filtering)
    const files = await collection
      .find(
        {}, // No filter - get everything
        { projection: { _id: 0, name: 1, path: 1, type: 1, updatedAt: 1 } }
      )
      .sort({ type: 1, name: 1, updatedAt: -1 })
      .toArray();

    const enhancedFiles = files.map(f => ({
      ...f,
      fullPath: f.path,
      extension: f.type === 'file' ? (f.name.includes('.') ? f.name.split('.').pop() : '') : ''
    }));

    res.json(enhancedFiles);
  } catch (err) {
    next(err);
  }
};

// Instead of using req.params.name, use the wildcard match
const getFile = async (req, res, next) => {
  try {
    const db = getDB();
    // Get the full path from the wildcard (everything after /api/files/)
    const fullPath = req.params[0]; // This captures the wildcard *
    
    const collection = db.collection(COLLECTION_NAME);
    const file = await collection.findOne(
      { path: fullPath, type: 'file' },
      { projection: { _id: 0 } }
    );
    
    if (!file) {
      return res.status(404).json({ error: `File not found: ${fullPath}` });
    }

    res.json({
      ...file,
      fullPath: file.path,
      extension: file.name.includes('.') ? file.name.split('.').pop() : ''
    });
  } catch (err) {
    next(err);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    const db = getDB();
    const fullPath = req.params[0]; // Get full path from wildcard
    
    const collection = db.collection(COLLECTION_NAME);
    const item = await collection.findOne({ path: fullPath });
    
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item.type === 'folder') {
      const regex = new RegExp(`^${fullPath}(/|$)`);
      await collection.deleteMany({ path: { $regex: regex } });
    } else {
      await collection.deleteOne({ path: fullPath });
    }

    res.json({ success: true, message: `${item.type} deleted` });
  } catch (err) {
    next(err);
  }
};

// ---------------- Preview HTML ----------------
const previewFile = async (req, res, next) => {
  try {
    const { name } = req.params;
    const parentPath = req.query.path ?? '';
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    const file = await collection.findOne({ path: fullPath, type: 'file' });
    if (!file) return res.status(404).send('File not found');
    if (!name.endsWith('.html')) return res.status(400).send('Preview only works for HTML files');

    res.type('html').send(file.content);
  } catch (err) {
    next(err);
  }
};

// ---------------- Serve Asset ----------------
const serveAsset = async (req, res, next) => {
  try {
    const { name } = req.params;
    const parentPath = req.query.path ?? '';
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    const file = await collection.findOne({ path: fullPath, type: 'file' });
    if (!file) return res.status(404).send('Asset not found');

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
