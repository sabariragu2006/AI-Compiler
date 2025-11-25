// controllers/fileController.js
const { getDB } = require('../db');
const mime = require('mime-types');

const COLLECTION_NAME = 'files';
const USER_STATE_COLLECTION = 'userProjectState';

const normalizePath = (p = '') => {
  return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
};

// ---------------- CREATE NEW PROJECT ----------------
const createProject = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectId = name.trim();
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    // Just return success — project appears when first file is saved
    console.log(`Project created: ${projectId}`);
    res.status(201).json({ id: projectId, name: projectId });
  } catch (err) {
    console.error('Create project error:', err);
    next(err);
  }
};

// ---------------- Save / Update File or Folder ----------------
const saveFile = async (req, res, next) => {
  try {
    const db = getDB();
    const { 
      name, 
      content = '', 
      path: parentPath = '', 
      type = 'file',
      projectId = 'default' 
    } = req.body;

    if (!name || (type === 'file' && content === undefined)) {
      return res.status(400).json({ error: 'Name and content are required for files' });
    }

    const collection = db.collection(COLLECTION_NAME);
    const cleanParent = normalizePath(parentPath);
    const fullPath = cleanParent ? `${cleanParent}/${name}` : name;

    // Check if item already exists with different type
    const existing = await collection.findOne({ projectId, path: fullPath });

    if (existing && existing.type !== type) {
      return res.status(400).json({
        error: `Cannot create ${type} '${name}' because a ${existing.type} already exists at this path`
      });
    }

    // Use upsert to create or update
    const result = await collection.updateOne(
      { projectId, path: fullPath },
      {
        $set: {
          name,
          path: fullPath,
          content: type === 'file' ? content : null,
          type,
          projectId,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`File/folder saved: ${fullPath} in project ${projectId}`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });

    res.json({
      success: true,
      projectId,
      path: fullPath,
      extension: type === 'file' && name.includes('.') ? name.split('.').pop() : '',
      message: type === 'file' ? 'File saved' : 'Folder saved',
      created: result.upsertedCount > 0
    });
  } catch (err) {
    console.error('Save file error:', err);
    next(err);
  }
};

// ---------------- Get All Projects ----------------
const getProjects = async (req, res, next) => {
  try {
    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const projectIds = await collection.distinct('projectId');
    const projects = projectIds.map(id => ({
      id,
      name: id
    }));

    res.json(projects);
  } catch (err) {
    console.error('Get projects error:', err);
    next(err);
  }
};

// ---------------- Get Files in a Project ----------------
const getFilesInProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Validate projectId
    if (!projectId || projectId === 'undefined' || projectId === 'default') {
      return res.json([]); // Return empty array for invalid project
    }

    const db = getDB();
    const collection = db.collection(COLLECTION_NAME);

    const files = await collection
      .find({ projectId }, { projection: { _id: 0, name: 1, path: 1, type: 1 } })
      .sort({ type: 1, path: 1 })
      .toArray();

    // Always return array — never 404
    res.json(files);
  } catch (err) {
    console.error('Get files error:', err);
    res.status(500).json([]); // Never send HTML
  }
};

// ---------------- Get Single File ----------------
const getFile = async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params[0] || '');
    const normalized = normalizePath(filePath);
    const { projectId = 'default' } = req.query;

    if (!projectId || projectId === 'default') {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const collection = getDB().collection(COLLECTION_NAME);
    const file = await collection.findOne({ projectId, path: normalized, type: 'file' });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json({
      name: file.name,
      content: file.content,
      path: normalized,
      projectId
    });
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ---------------- Rename File or Folder ----------------
const renameFile = async (req, res, next) => {
  try {
    const oldPath = decodeURIComponent(req.params[0] || '');
    const normalized = normalizePath(oldPath);
    const { projectId = 'default' } = req.query;
    const { newName } = req.body;

    if (!projectId || projectId === 'default') {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const collection = getDB().collection(COLLECTION_NAME);
    const item = await collection.findOne({ projectId, path: normalized });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const pathParts = normalized.split('/');
    pathParts[pathParts.length - 1] = newName.trim();
    const newPath = pathParts.join('/');

    const existing = await collection.findOne({ projectId, path: newPath });
    if (existing) {
      return res.status(400).json({ error: 'An item with this name already exists' });
    }

    if (item.type === 'folder') {
      const escapedOld = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escapedOld}(/|$)`);
      const childItems = await collection.find({ projectId, path: { $regex: regex } }).toArray();

      const bulkOps = childItems.map(child => {
        const newChildPath = child.path.replace(normalized, newPath);
        return {
          updateOne: {
            filter: { _id: child._id },
            update: { 
              $set: { 
                path: newChildPath,
                name: child.path === normalized ? newName.trim() : child.name,
                updatedAt: new Date()
              } 
            }
          }
        };
      });

      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
      }
    } else {
      await collection.updateOne(
        { projectId, path: normalized },
        { 
          $set: { 
            name: newName.trim(), 
            path: newPath,
            updatedAt: new Date()
          } 
        }
      );
    }

    res.json({ 
      success: true, 
      message: `${item.type} renamed successfully`,
      oldPath: normalized,
      newPath
    });
  } catch (err) {
    console.error('Rename error:', err);
    next(err);
  }
};

// ---------------- Delete File or Folder ----------------
const deleteFile = async (req, res, next) => {
  try {
    const fullPath = decodeURIComponent(req.params[0] || '');
    const normalized = normalizePath(fullPath);
    const { projectId = 'default' } = req.query;

    if (!projectId || projectId === 'default') {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const collection = getDB().collection(COLLECTION_NAME);
    const item = await collection.findOne({ projectId, path: normalized });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found', path: normalized });
    }

    if (item.type === 'folder') {
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}(/|$)`);
      await collection.deleteMany({ projectId, path: { $regex: regex } });
    } else {
      await collection.deleteOne({ projectId, path: normalized });
    }

    res.json({ success: true, message: `${item.type} deleted` });
  } catch (err) {
    console.error('Delete error:', err);
    next(err);
  }
};

// ---------------- Delete Entire Project ----------------
const deleteProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const collection = getDB().collection(COLLECTION_NAME);
    const result = await collection.deleteMany({ projectId });
    res.json({ success: true, message: 'Project deleted', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Delete project error:', err);
    next(err);
  }
};

// ---------------- Preview HTML ----------------
const previewFile = async (req, res, next) => {
  try {
    const filePath = decodeURIComponent(req.params[0] || '');
    const normalized = normalizePath(filePath);
    const { projectId = 'default' } = req.query;

    if (!projectId || projectId === 'default') {
      return res.status(400).send('Invalid project');
    }
    if (!normalized.endsWith('.html')) {
      return res.status(400).send('Preview only works for HTML files');
    }

    const collection = getDB().collection(COLLECTION_NAME);
    const file = await collection.findOne({ projectId, path: normalized, type: 'file' });
    
    if (!file) return res.status(404).send('File not found');

    res.setHeader('Content-Type', 'text/html');
    res.send(file.content);
  } catch (err) {
    console.error('Preview file error:', err);
    next(err);
  }
};

// ---------------- Serve Asset ----------------
const serveAsset = async (req, res, next) => {
  try {
    const assetPath = decodeURIComponent(req.params[0] || '');
    const normalized = normalizePath(assetPath);
    const { projectId = 'default' } = req.query;

    if (!projectId || projectId === 'default') {
      return res.status(400).send('Invalid project');
    }

    const collection = getDB().collection(COLLECTION_NAME);
    const possiblePaths = [normalized, `./${normalized}`, `/${normalized}`, assetPath];
    let file = null;
    for (const tryPath of possiblePaths) {
      file = await collection.findOne({ projectId, path: tryPath, type: 'file' });
      if (file) break;
    }
    
    if (!file) {
      return res.status(404).send('Asset not found');
    }

    const mimeType = mime.lookup(normalized) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(file.content);
  } catch (err) {
    console.error('Serve asset error:', err);
    next(err);
  }
};

// ---------------- Get User Project State ----------------
const getUserState = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const db = getDB();
    const collection = db.collection(USER_STATE_COLLECTION);
    
    const state = await collection.findOne({ userId });
    
    if (!state) {
      return res.json({
        userId,
        lastActiveProject: null,
        expandedFolders: [],
        selectedFile: null
      });
    }

    res.json({
      userId: state.userId,
      lastActiveProject: state.lastActiveProject || null,
      expandedFolders: state.expandedFolders || [],
      selectedFile: state.selectedFile || null
    });
  } catch (err) {
    console.error('Get user state error:', err);
    next(err);
  }
};

// ---------------- Update User Project State ----------------
const updateUserState = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { lastActiveProject, expandedFolders, selectedFile } = req.body;
    
    const db = getDB();
    const collection = db.collection(USER_STATE_COLLECTION);
    
    const updateFields = { updatedAt: new Date() };
    if (lastActiveProject !== undefined) updateFields.lastActiveProject = lastActiveProject;
    if (expandedFolders !== undefined) updateFields.expandedFolders = expandedFolders;
    if (selectedFile !== undefined) updateFields.selectedFile = selectedFile;
    
    await collection.updateOne(
      { userId },
      {
        $set: updateFields,
        $setOnInsert: { userId, createdAt: new Date() }
      },
      { upsert: true }
    );

    res.json({ success: true, message: 'User state updated' });
  } catch (err) {
    console.error('Update user state error:', err);
    next(err);
  }
};

module.exports = {
  createProject,
  saveFile,
  getProjects,
  getFilesInProject,
  getFile,
  renameFile,
  deleteFile,
  deleteProject,
  previewFile,
  serveAsset,
  getUserState,
  updateUserState
};