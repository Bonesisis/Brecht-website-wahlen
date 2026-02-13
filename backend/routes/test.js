const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'test_votes.json');

// Einfacher Lock-Mechanismus
let isWriting = false;
const writeQueue = [];

async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // dir existiert bereits
  }
}

async function readVotes() {
  try {
    await ensureDir();
    const content = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(content);
    return {
      yes: Number(data.yes) || 0,
      no: Number(data.no) || 0,
      total: (Number(data.yes) || 0) + (Number(data.no) || 0)
    };
  } catch (err) {
    // Datei existiert nicht oder ist ungültig
    return { yes: 0, no: 0, total: 0 };
  }
}

async function writeVotes(yes, no) {
  return new Promise((resolve, reject) => {
    const doWrite = async () => {
      isWriting = true;
      try {
        await ensureDir();
        const tmpFile = DATA_FILE + '.tmp';
        await fs.writeFile(tmpFile, JSON.stringify({ yes, no }, null, 2), 'utf8');
        await fs.rename(tmpFile, DATA_FILE);
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        isWriting = false;
        if (writeQueue.length > 0) {
          const next = writeQueue.shift();
          doWrite().then(next.resolve).catch(next.reject);
        }
      }
    };

    if (isWriting) {
      writeQueue.push({ resolve, reject });
    } else {
      doWrite().then(resolve).catch(reject);
    }
  });
}

// GET /api/test/votes
router.get('/votes', async (req, res) => {
  try {
    const data = await readVotes();
    res.json(data);
  } catch (err) {
    console.error('readVotes error:', err);
    res.status(500).json({ error: 'read_failed' });
  }
});

// POST /api/test/vote
router.post('/vote', express.json(), async (req, res) => {
  try {
    const choice = req.body?.choice;
    
    if (choice !== 'yes' && choice !== 'no') {
      return res.status(400).json({ error: 'invalid_choice' });
    }

    const current = await readVotes();
    const yes = current.yes + (choice === 'yes' ? 1 : 0);
    const no = current.no + (choice === 'no' ? 1 : 0);

    await writeVotes(yes, no);

    res.json({
      success: true,
      yes,
      no,
      total: yes + no
    });
  } catch (err) {
    console.error('vote error:', err);
    res.status(500).json({ error: 'write_failed' });
  }
});

// GET /api/test/stats (für Admin)
router.get('/stats', async (req, res) => {
  try {
    const data = await readVotes();
    const percentage = {
      yes: data.total > 0 ? Math.round((data.yes / data.total) * 100) : 0,
      no: data.total > 0 ? Math.round((data.no / data.total) * 100) : 0
    };
    res.json({ ...data, percentage });
  } catch (err) {
    console.error('stats error:', err);
    res.status(500).json({ error: 'read_failed' });
  }
});

module.exports = router;