const { getDB } = require('../db'); // <- use getDB

const COLLECTION_NAME = 'files';

const saveFile = async (req, res, next) => {
  try {
    const mongob = getDB(); // get the latest DB instance
    const { name, content } = req.body;
    if (!name || content === undefined) return res.status(400).json({ error: 'Name and content are required' });

    const collection = mongob.collection(COLLECTION_NAME);
    const result = await collection.updateOne(
      { name },
      { $set: { content, updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({
      success: true,
      message: result.upsertedCount ? 'File created' : 'File updated'
    });
  } catch (err) {
    next(err);
  }
};

// Similarly update getFiles, getFile, deleteFile:
const getFiles = async (req, res, next) => {
  try {
    const mongob = getDB();
    const collection = mongob.collection(COLLECTION_NAME);
    const files = await collection.find({}, { projection: { _id: 0, name: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .toArray();
    res.json(files);
  } catch (err) {
    next(err);
  }
};

const getFile = async (req, res, next) => {
  try {
    const mongob = getDB();
    const { name } = req.params;
    const collection = mongob.collection(COLLECTION_NAME);
    const file = await collection.findOne({ name }, { projection: { _id: 0 } });
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json(file);
  } catch (err) {
    next(err);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    const mongob = getDB();
    const { name } = req.params;
    const collection = mongob.collection(COLLECTION_NAME);
    const result = await collection.deleteOne({ name });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'File not found' });
    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { saveFile, getFiles, getFile, deleteFile };
