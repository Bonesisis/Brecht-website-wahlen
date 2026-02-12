const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'test_votes.json');
let writeLock = false; // einfacher in-prozess Lock

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ yes: 0, no: 0 }, null, 2), 'utf8');
  }
}

async function readVotes() {
  await ensureData();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const obj = JSON.parse(raw || '{}');
  const yes = Number(obj.yes) || 0;
  const no = Number(obj.no) || 0;
  return { yes, no, total: yes + no };
}

async function writeVotes(yes, no) {
  // einfacher in-prozess Lock, retry wenn belegt
  while (writeLock) await new Promise(r => setTimeout(r, 10));
  writeLock = true;
  try {
    await ensureData();
    const tmp = DATA_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify({ yes, no }, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE); // atomisch umbenennen
  } finally {
    writeLock = false;
  }
}

router.get('/votes', async (req, res) => {
  try {
    const v = await readVotes();
    res.json(v);
  } catch (err) {
    console.error('readVotes error', err);
    res.status(500).json({ error: 'read_failed' });
  }
});

router.post('/vote', express.json(), async (req, res) => {
  try {
    const choice = req.body && req.body.choice;
    if (choice !== 'yes' && choice !== 'no') {
      return res.status(400).json({ error: 'invalid_choice' });
    }
    const current = await readVotes();
    const yes = current.yes + (choice === 'yes' ? 1 : 0);
    const no = current.no + (choice === 'no' ? 1 : 0);
    await writeVotes(yes, no);
    res.json({ success: true, yes, no, total: yes + no });
  } catch (err) {
    console.error('vote error', err);
    res.status(500).json({ error: 'write_failed' });
  }
});

module.exports = router;