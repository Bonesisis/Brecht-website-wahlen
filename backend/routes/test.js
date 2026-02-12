const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'test_votes.json');

async function readVotes() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const obj = JSON.parse(raw);
    return { yes: obj.yes || 0, no: obj.no || 0, total: (obj.yes || 0) + (obj.no || 0) };
  } catch (e) {
    return { yes: 0, no: 0, total: 0 };
  }
}

async function writeVotes(yes, no) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify({ yes, no }, null, 2), 'utf8');
}

router.get('/votes', async (req, res) => {
  const v = await readVotes();
  res.json(v);
});

router.post('/vote', express.json(), async (req, res) => {
  const choice = req.body && req.body.choice;
  if (choice !== 'yes' && choice !== 'no') {
    return res.status(400).json({ error: 'Ungültige Wahl. Verwende "yes" oder "no".' });
  }
  const current = await readVotes();
  const yes = current.yes + (choice === 'yes' ? 1 : 0);
  const no = current.no + (choice === 'no' ? 1 : 0);
  await writeVotes(yes, no);
  res.json({ success: true, yes, no, total: yes + no });
});

module.exports = router;