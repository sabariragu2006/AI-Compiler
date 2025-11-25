// middleware/validateModel.js

function validateModel(req, res, next) {
  const { model } = req.body;
  if (model !== 'qwen' && model !== 'deepseek') {
    return res.status(400).json({ error: 'Only "qwen" or "deepseek" models are supported.' });
  }
  next();
}

module.exports = { validateModel };
