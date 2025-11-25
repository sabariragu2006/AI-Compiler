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
      currentPath: '/',
      projectId: 'default', // ← default project
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

// Helper to find file/folder with normalized path AND projectId
const findByPath = async (collection, projectId, targetPath, type = null) => {
  const normalized = normalizePath(targetPath);
  const query = { projectId, path: normalized };
  if (type) query.type = type;
  return await collection.findOne(query);
};

// Helper to list items in current directory (project-scoped)
const listItems = async (collection, projectId, basePath) => {
  const normalizedBase = normalizePath(basePath);
  let items = [];

  if (normalizedBase === '') {
    // Root level: match paths with no slash
    items = await collection
      .find({ projectId, path: { $regex: /^[^\/]+$/ } })
      .sort({ type: 1, name: 1 })
      .toArray();
  } else {
    // Subdirectory: match direct children
    const pattern = `^${escapeRegex(normalizedBase)}\/[^\/]+$`;
    items = await collection
      .find({ projectId, path: { $regex: pattern } })
      .sort({ type: 1, name: 1 })
      .toArray();
  }

  return items;
};

const handleCommand = async (req, res) => {
  try {
    const { command, sessionId = 'default', projectId = 'default' } = req.body;

    // Ensure session uses the provided projectId (e.g., when switching projects)
    let session = await getSession(sessionId);
    if (session.projectId !== projectId) {
      await updateSession(sessionId, { projectId, currentPath: '/' });
      session = { ...session, projectId, currentPath: '/' };
    }

    if (!command) {
      return res.json({
        success: false,
        output: ['No command given'],
        currentPath: session.currentPath,
        projectId: session.projectId
      });
    }

    const db = getDB();
    const filesCollection = db.collection('files');
    let { currentPath } = session;

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');
    const cleanArg = normalizePath(arg);
    const dbCurrentPath = normalizePath(currentPath);

    switch (cmd) {
      case 'pwd':
        return res.json({
          success: true,
          output: [currentPath],
          currentPath,
          projectId: session.projectId
        });

      case 'cd': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['cd: missing argument'],
            currentPath,
            projectId: session.projectId
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
            currentPath,
            projectId: session.projectId
          });
        }

        if (cleanArg === '' || cleanArg === '~') {
          currentPath = '/';
          await updateSession(sessionId, { currentPath });
          return res.json({
            success: true,
            output: [`Changed directory → ${currentPath}`],
            currentPath,
            projectId: session.projectId
          });
        }

        const targetPath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const folder = await findByPath(filesCollection, session.projectId, targetPath, 'folder');
        if (!folder) {
          return res.json({
            success: false,
            output: [`cd: ${arg}: No such folder`],
            currentPath,
            projectId: session.projectId
          });
        }

        currentPath = '/' + normalizePath(folder.path);
        await updateSession(sessionId, { currentPath });

        return res.json({
          success: true,
          output: [`Changed directory → ${currentPath}`],
          currentPath,
          projectId: session.projectId
        });
      }

      case 'mkdir': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['mkdir: missing folder name'],
            currentPath,
            projectId: session.projectId
          });
        }

        const newFolderPath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const existing = await findByPath(filesCollection, session.projectId, newFolderPath);
        if (existing) {
          return res.json({
            success: false,
            output: [`mkdir: ${arg}: Already exists`],
            currentPath,
            projectId: session.projectId
          });
        }

        await filesCollection.insertOne({
          name: path.basename(cleanArg),
          path: newFolderPath,
          type: 'folder',
          content: null,
          projectId: session.projectId,
          updatedAt: new Date()
        });

        return res.json({
          success: true,
          output: [`Folder created: ${arg}`],
          currentPath,
          projectId: session.projectId
        });
      }

      case 'ls':
      case 'dir': {
        const items = await listItems(filesCollection, session.projectId, dbCurrentPath);

        if (items.length === 0) {
          return res.json({
            success: true,
            output: ['  (empty directory)'],
            currentPath,
            projectId: session.projectId
          });
        }

        const output = items.map(f =>
          f.type === 'folder' ? `  ${f.name}/` : `  ${f.name}`
        );

        return res.json({
          success: true,
          output,
          currentPath,
          projectId: session.projectId
        });
      }

      case 'cat':
      case 'type': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['cat: missing file name'],
            currentPath,
            projectId: session.projectId
          });
        }

        const filePath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const file = await findByPath(filesCollection, session.projectId, filePath, 'file');
        if (!file) {
          return res.json({
            success: false,
            output: [`cat: ${arg}: No such file`],
            currentPath,
            projectId: session.projectId
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
          currentPath,
          projectId: session.projectId
        });
      }

      case 'touch': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['touch: missing file name'],
            currentPath,
            projectId: session.projectId
          });
        }

        const newFilePath = normalizePath(
          dbCurrentPath === '' ? cleanArg : `${dbCurrentPath}/${cleanArg}`
        );

        const existingFile = await findByPath(filesCollection, session.projectId, newFilePath);
        if (existingFile) {
          await filesCollection.updateOne(
            { _id: existingFile._id },
            { $set: { updatedAt: new Date() } }
          );
          return res.json({
            success: true,
            output: [`Updated timestamp: ${arg}`],
            currentPath,
            projectId: session.projectId
          });
        }

        await filesCollection.insertOne({
          name: path.basename(cleanArg),
          path: newFilePath,
          type: 'file',
          content: '',
          projectId: session.projectId,
          updatedAt: new Date()
        });

        return res.json({
          success: true,
          output: [`File created: ${arg}`],
          currentPath,
          projectId: session.projectId
        });
      }

      case 'rm':
      case 'del': {
        if (!cleanArg) {
          return res.json({
            success: false,
            output: ['rm: missing file name'],
            currentPath,
            projectId: session.projectId
          });
        }

        const isRecursive = parts.includes('-r');
        const targetName = parts.filter(p => p !== '-r')[1];
        if (!targetName) {
          return res.json({
            success: false,
            output: ['rm: missing file or folder name'],
            currentPath,
            projectId: session.projectId
          });
        }

        const targetPath = normalizePath(
          dbCurrentPath === '' ? targetName : `${dbCurrentPath}/${targetName}`
        );

        const targetItem = await findByPath(filesCollection, session.projectId, targetPath);
        if (!targetItem) {
          return res.json({
            success: false,
            output: [`rm: ${targetName}: No such file or folder`],
            currentPath,
            projectId: session.projectId
          });
        }

        if (targetItem.type === 'folder') {
          const normalizedDeletePath = normalizePath(targetItem.path);
          if (!isRecursive) {
            const hasContents = await filesCollection.findOne({
              projectId: session.projectId,
              path: { $regex: `^${escapeRegex(normalizedDeletePath)}/` }
            });

            if (hasContents) {
              return res.json({
                success: false,
                output: [`rm: ${targetName}: Directory not empty (use rm -r to delete)`],
                currentPath,
                projectId: session.projectId
              });
            }
          }

          await filesCollection.deleteMany({
            projectId: session.projectId,
            path: { $regex: `^${escapeRegex(normalizedDeletePath)}(/|$)` }
          });
        } else {
          await filesCollection.deleteOne({ _id: targetItem._id });
        }

        return res.json({
          success: true,
          output: [`Deleted: ${targetName}`],
          currentPath,
          projectId: session.projectId
        });
      }

      case 'clear':
      case 'cls':
        return res.json({
          success: true,
          output: ['[CLEAR]'],
          currentPath,
          projectId: session.projectId
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
            '  rm <file>       - Delete file',
            '  touch <file>    - Create empty file',
            '  clear / cls     - Clear terminal',
            '  help            - Show this help',
            ''
          ],
          currentPath,
          projectId: session.projectId
        });

      default:
        return res.json({
          success: false,
          output: [`Unknown command: ${cmd}. Type 'help' for available commands.`],
          currentPath,
          projectId: session.projectId
        });
    }
  } catch (err) {
    console.error('Terminal error:', err);
    return res.json({
      success: false,
      output: [`ERROR: ${err.message}`],
      currentPath: '/',
      projectId: 'default'
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
      currentPath: session.currentPath,
      projectId: session.projectId
    });
  } catch (err) {
    console.error('Error getting session:', err);
    res.json({
      success: false,
      currentPath: '/',
      projectId: 'default'
    });
  }
};

module.exports = { handleCommand, getSessionState };