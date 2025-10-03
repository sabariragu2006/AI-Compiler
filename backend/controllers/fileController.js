// controllers/files.js
const { getDB } = require('../db');
const path = require('path');

const COLLECTION_NAME = 'files';

// Normalize paths for DB queries (remove leading/trailing slashes)
const normalizePath = (p = '') => p.replace(/^\/+|\/+$/g, '');

let currentPath = '/'; // terminal display path

// ---------------- Save / Update File or Folder ----------------
const saveFile = async (req, res, next) => {
  try {
    const db = getDB();
    const { name, content = '', path: parentPath = '', type = 'file' } = req.body;

    if (!name || (type === 'file' && content === undefined)) {
      return res.status(400).json({ error: 'Name and content are required for files' });
    }

    const collection = db.collection(COLLECTION_NAME);
    const cleanParent = normalizePath(parentPath);
    const fullPath = cleanParent ? `${cleanParent}/${name}` : name;

    const existing = await collection.findOne({ path: fullPath });

    if (existing && existing.type !== type) {
      return res.status(400).json({
        error: `Cannot create ${type} '${name}' because a ${existing.type} already exists at this path`
      });
    }

    await collection.updateOne(
      { path: fullPath },
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
      message: type === 'file' ? 'File saved' : 'Folder saved'
    });
  } catch (err) {
    next(err);
  }
};

// ---------------- Get All Files / Folders ----------------
const getFiles = async (req, res, next) => {
  try {
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    const files = await collection
      .find({}, { projection: { _id: 0, name: 1, path: 1, type: 1, updatedAt: 1 } })
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

// ---------------- Get Single File ----------------
const getFile = async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('files');

    // Use req.params[0] for wildcard
    const filePath = req.params[0]; 
    const normalized = filePath.replace(/^\/+|\/+$/g, '');

    const file = await collection.findOne({ path: normalized, type: 'file' });
    if (!file) return res.status(404).json({ message: 'File not found' });

    res.json({ name: file.name, content: file.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


// ---------------- Delete File or Folder ----------------
const deleteFile = async (req, res, next) => {
  try {
    const db = getDB();
    const fullPath = req.params[0];
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

// ---------------- Terminal Commands ----------------
const handleTerminalCommand = async (command) => {
  const db = getDB();
  const collection = db.collection(COLLECTION_NAME);

  const parts = command.trim().split(/\s+/);
  const cmd = parts[0];
  const arg = parts[1];

  switch (cmd) {
    case 'pwd':
      return [currentPath];

    case 'cd':
      if (!arg) return ['cd: missing argument'];
      if (arg === '..') {
        if (currentPath !== '/') {
          const parent = path.dirname(normalizePath(currentPath));
          currentPath = parent ? '/' + parent : '/';
        }
        return [`Changed directory → ${currentPath}`];
      } else {
        const targetPath = path.join(normalizePath(currentPath), arg).replace(/\\/g, '/');
        const folder = await collection.findOne({ path: targetPath, type: 'folder' });
        if (!folder) return [`cd: ${arg}: No such folder`];
        currentPath = '/' + targetPath;
        return [`Changed directory → ${currentPath}`];
      }

    case 'mkdir':
      if (!arg) return ['mkdir: missing folder name'];
      const newFolderPath = path.join(normalizePath(currentPath), arg).replace(/\\/g, '/');
      await collection.updateOne(
        { path: newFolderPath },
        { $set: { name: arg, path: newFolderPath, type: 'folder', content: null, updatedAt: new Date() } },
        { upsert: true }
      );
      return [`Folder '${arg}' created at ${currentPath}`];

    case 'ls':
      const regex = currentPath === '/'
        ? /^[^/]+$/          // root children
        : new RegExp(`^${normalizePath(currentPath)}/[^/]+$`);
      const items = await collection.find({ path: { $regex: regex } }).toArray();
      return items.map(f => (f.type === 'folder' ? `📁 ${f.name}` : `📄 ${f.name}`));

    default:
      return [`Unknown command: ${cmd}`];
  }
};

module.exports = {
  saveFile,
  getFiles,
  getFile,
  deleteFile,
  previewFile,
  serveAsset,
  handleTerminalCommand
};
