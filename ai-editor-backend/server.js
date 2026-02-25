const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// chunk helper
function chunkText(text, chunkSize = 2000) {
  const lines = text.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize).join('\n'));
  }
  return chunks;
}

app.post('/api/edit-file', async (req, res) => {
  try {
    const { filePath, instructions } = req.body;
    if (!filePath || !instructions) return res.status(400).json({ error: 'Missing filePath or instructions' });

    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

    const originalContent = fs.readFileSync(fullPath, 'utf8');
    const chunks = chunkText(originalContent, 1000);
    const updatedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      const prompt = `
You are a helpful code assistant.
Edit the following snippet according to instructions:
${instructions}

Snippet:
${chunks[i]}

Return only the updated snippet.
`;

      const response = await axios.post("http://127.0.0.1:1234/v1/completions", {
        model: "qwen/qwen3-1.7b",
        prompt,
        max_tokens: 500,
        temperature: 0.7
      });

      updatedChunks.push(response.data.choices?.[0]?.text || chunks[i]);
    }

    const updatedContent = updatedChunks.join('\n');
    fs.writeFileSync(fullPath, updatedContent, 'utf8');

    res.json({ message: 'File updated successfully', filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`AI editor API running on port ${PORT}`));