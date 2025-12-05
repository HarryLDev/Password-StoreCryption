const express = require('express');
const fs = require('fs');
const path = require('path');
const { createPasswordVerifier, verifyPassword, deriveKey, encryptBuffer, decryptBuffer } = require('./crypto-utils');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const VAULT_FILE = path.join(__dirname, 'storage.json');
const META_FILE = path.join(__dirname, 'meta.json');

function loadVault() {
  if (!fs.existsSync(VAULT_FILE)) return null;
  return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
}
function saveVault(obj) {
  fs.writeFileSync(VAULT_FILE, JSON.stringify(obj, null, 2));
}

app.get('/api/has-master', (req, res) => {
  res.json({ hasMaster: fs.existsSync(META_FILE) });
});

app.post('/api/setup-master', (req, res) => {
  if (fs.existsSync(META_FILE)) return res.status(400).json({ error: 'Master already set' });
  const { password } = req.body;
  if (!password || (password.length < 8)) return res.status(400).json({ error: 'Password too weak (min 8 chars)' });
  const meta = createPasswordVerifier(password);
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
  const key = deriveKey(password, Buffer.from(meta.salt, 'base64'));
  const empty = JSON.stringify({ entries: [] });
  const enc = encryptBuffer(key, empty);
  saveVault(enc);
  res.json({ ok: true });
});

// Simple in-memory session store (for demo only)
const serverSessions = {}; // token -> { key }

app.post('/api/login', (req, res) => {
  if (!fs.existsSync(META_FILE)) return res.status(400).json({ error: 'Master not set' });
  const { password } = req.body;
  const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  const ok = verifyPassword(password, meta.salt, meta.verifier);
  if (!ok) return res.status(401).json({ error: 'Invalid password' });
  const key = deriveKey(password, Buffer.from(meta.salt, 'base64'));
  const token = randomUUID();
  serverSessions[token] = { key };
  res.json({ token });
});

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !serverSessions[token]) return res.status(401).json({ error: 'Unauthorized' });
  req.session = serverSessions[token];
  next();
}

app.post('/api/entry', authMiddleware, (req, res) => {
  const { key } = req.session;
  const enc = loadVault();
  if (!enc) return res.status(500).json({ error: 'No vault' });
  const plain = JSON.parse(decryptBuffer(key, enc));
  const { site, username, password } = req.body;
  if (!site || !username || !password) return res.status(400).json({ error: 'Missing fields' });
  plain.entries.push({ id: Date.now(), site, username, password });
  const newEnc = encryptBuffer(key, JSON.stringify(plain));
  saveVault(newEnc);
  res.json({ ok: true });
});

app.get('/api/entries', authMiddleware, (req, res) => {
  const { key } = req.session;
  const enc = loadVault();
  if (!enc) return res.status(500).json({ error: 'No vault' });
  const plain = JSON.parse(decryptBuffer(key, enc));
  res.json({ entries: plain.entries });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) delete serverSessions[token];
  res.json({ ok: true });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Password manager running on http://localhost:${PORT}`));
