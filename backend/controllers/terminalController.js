// controllers/terminalController.js
const { getDB } = require('../db');
const path = require('path');

const SESSIONS_COLLECTION = 'terminal_sessions';

const normalizePath = (p = '') => p.replace(/^\/+|\/+$/g, '');
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get or create session from database
const getSession = async (sessionId) => {
  const db = getDB();
  const collection = db.collection(SESSIONS_COLLECTION);

  let session = await collection.findOne({ sessionId });

  if (!session) {
    session = {
      sessionId,
      currentPath: '/', // session always stores path with leading slash
      lastActive: new Date()
    };
    await collection.insertOne(session);
  }

  return session;
};

// Update session in database
const updateSession = async (sessionId, updates) => {
  const db = getDB();
  const collection = db.collection(SESSIONS_COLLECTION);

  await collection.updateOne(
    { sessionId },
    {
      $set: {
        ...updates,
        lastActive: new Date()
      }
    },
    { upsert: true }
  );
};

// Helper to find file/folder with normalized path
const findByPath = async (collection, targetPath, type = null) => {
  const normalized = normalizePath(targetPath); // always without leading slash

  const query = { path: normalized };
  if (type) query.type = type;

  return await collection.findOne(query);
};

const handleCommand = async (req, res) => {
  try {
    const { command, sessionId = 'default' } = req.body;

    if (!command) {
      const session = await getSession(sessionId);
      return res.json({
        success: false,
        output: ['No command given'],
        currentPath: session.currentPath
      });
    }

    const db = getDB();
    const collection = db.collection('files');
    const session = await getSession(sessionId);
    let { currentPath } = session;

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');
    const cleanArg = normalizePath(arg); // 🔑 always normalize user input

    // Convert session currentPath (with `/`) into dbPath (without `/`)
    const dbCurrentPath = normalizePath(currentPath);

    switch (cmd) {
      case 'pwd':
        return res.json({
          success: true,
          output: [currentPath],
          currentPath
        });

      case 'cd': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['cd: missing argument'],
            currentPath
          });
        }

        if (cleanArg === '..') {
          if (currentPath !== '/') {
            const parent = normalizePath(path.dirname(dbCurrentPath));
            currentPath = parent ? '/' + parent : '/';
          }
          await updateSession(sessionId, { currentPath });
          return res.json({
            success: true,
            output: [`Changed directory → ${currentPath}`],
            currentPath
          });
        }

        if (cleanArg === '' || cleanArg === '~') {
          currentPath = '/';
          await updateSession(sessionId, { currentPath });
          return res.json({
            success: true,
            output: [`Changed directory → ${currentPath}`],
            currentPath
          });
        }

        // Build db target path (without leading slash)
        const targetPath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const folder = await findByPath(collection, targetPath, 'folder');
        if (!folder) {
          return res.json({
            success: false,
            output: [`cd: ${arg}: No such folder`],
            currentPath
          });
        }

        currentPath = '/' + normalizePath(folder.path);
        await updateSession(sessionId, { currentPath });

        return res.json({
          success: true,
          output: [`Changed directory → ${currentPath}`],
          currentPath
        });
      }

      case 'mkdir': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['mkdir: missing folder name'],
            currentPath
          });
        }

        const newFolderPath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const existing = await findByPath(collection, newFolderPath);
        if (existing) {
          return res.json({
            success: false,
            output: [`mkdir: ${arg}: Already exists`],
            currentPath
          });
        }

        await collection.insertOne({
          name: path.basename(cleanArg),
          path: newFolderPath, // always stored without leading slash
          type: 'folder',
          content: null,
          updatedAt: new Date()
        });

        return res.json({
          success: true,
          output: [`Folder created: ${arg}`],
          currentPath
        });
      }

      case 'ls':
      case 'dir': {
        const normalizedCurrent = dbCurrentPath;

        let items = [];
        if (normalizedCurrent === '') {
          // Root → only top-level items
          items = await collection
            .find({ path: { $regex: /^[^/]+$/ } })
            .sort({ type: 1, name: 1 })
            .toArray();
        } else {
          const pattern = `^${escapeRegex(normalizedCurrent)}/[^/]+$`;
          items = await collection
            .find({ path: { $regex: pattern } })
            .sort({ type: 1, name: 1 })
            .toArray();
        }

        if (items.length === 0) {
          return res.json({
            success: true,
            output: ['  (empty directory)'],
            currentPath
          });
        }

        const output = items.map(f =>
          f.type === 'folder' ? `  ${f.name}/` : `  ${f.name}`
        );

        return res.json({
          success: true,
          output,
          currentPath
        });
      }

      case 'cat':
      case 'type': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['cat: missing file name'],
            currentPath
          });
        }

        const filePath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const file = await findByPath(collection, filePath, 'file');
        if (!file) {
          return res.json({
            success: false,
            output: [`cat: ${arg}: No such file`],
            currentPath
          });
        }

        return res.json({
          success: true,
          output: [
            '',
            `--- ${file.name} ---`,
            file.content || '(empty file)',
            `--- End of ${file.name} ---`,
            ''
          ],
          currentPath
        });
      }

      case 'touch': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['touch: missing file name'],
            currentPath
          });
        }

        const newFilePath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const existingFile = await findByPath(collection, newFilePath);
        if (existingFile) {
          await collection.updateOne(
            { _id: existingFile._id },
            { $set: { updatedAt: new Date() } }
          );
          return res.json({
            success: true,
            output: [`Updated timestamp: ${arg}`],
            currentPath
          });
        }

        await collection.insertOne({
          name: path.basename(cleanArg),
          path: newFilePath,
          type: 'file',
          content: '',
          updatedAt: new Date()
        });

        return res.json({
          success: true,
          output: [`File created: ${arg}`],
          currentPath
        });
      }

      case 'rm':
      case 'del': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['rm: missing file name'],
            currentPath
          });
        }

        const deleteFilePath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const fileToDelete = await findByPath(collection, deleteFilePath);
        if (!fileToDelete) {
          return res.json({
            success: false,
            output: [`rm: ${arg}: No such file or folder`],
            currentPath
          });
        }

        if (fileToDelete.type === 'folder') {
          const normalizedDeletePath = normalizePath(fileToDelete.path);
          const hasContents = await collection.findOne({
            path: { $regex: `^${escapeRegex(normalizedDeletePath)}/` }
          });

          if (hasContents) {
            return res.json({
              success: false,
              output: [`rm: ${arg}: Directory not empty (use rm -r to delete)`],
              currentPath
            });
          }
        }

        await collection.deleteOne({ _id: fileToDelete._id });

        return res.json({
          success: true,
          output: [`Deleted: ${arg}`],
          currentPath
        });
      }

      case 'clear':
      case 'cls':
        return res.json({
          success: true,
          output: ['[CLEAR]'],
          currentPath
        });

      case 'help':
        return res.json({
          success: true,
          output: [
            '',
            'Available Commands:',
            '  cd <folder>     - Change directory',
            '  cd ..           - Go up one level',
            '  cd / or cd ~    - Go to root',
            '  ls / dir        - List files and folders',
            '  pwd             - Show current path',
            '  mkdir <name>    - Create new folder',
            '  cat <file>      - View file content',
            '  open <file>     - Open file in editor',
            '  rm <file>       - Delete file',
            '  touch <file>    - Create empty file',
            '  clear / cls     - Clear terminal',
            '  help            - Show this help',
            ''
          ],
          currentPath
        });

      default:
        return res.json({
          success: false,
          output: [`Unknown command: ${cmd}. Type 'help' for available commands.`],
          currentPath
        });
    }
  } catch (err) {
    console.error('Terminal error:', err);
    return res.json({
      success: false,
      output: [`ERROR: ${err.message}`],
      currentPath: '/'
    });
  }
};

// Get current session state
const getSessionState = async (req, res) => {
  try {
    const { sessionId = 'default' } = req.query;
    const session = await getSession(sessionId);

    res.json({
      success: true,
      currentPath: session.currentPath
    });
  } catch (err) {
    console.error('Error getting session:', err);
    res.json({
      success: false,
      currentPath: '/'
    });
  }
};

module.exports = { handleCommand, getSessionState };
