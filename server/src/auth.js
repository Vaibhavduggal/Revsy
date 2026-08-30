// Lightweight auth (no external deps)
// Random signed tokens stored in tokenDB, with business/token mappings.
// Passwords are hashed server-side with bcrypt.
const { getDb } = require('./db.js');
const bcrypt = require('bcryptjs');

const TOKEN_PREFIX = 'tkn';
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomToken() {
  let id = TOKEN_PREFIX;
  for (let i = 0; i < 32; i++) id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  return id;
}

function generateToken(businessId) {
  const db = getDb();
  const token = randomToken();
  db.data.tokenDB = db.data.tokenDB || {};
  db.data.tokenDB[token] = { businessId, createdAt: new Date().toISOString() };
  db.write();
  return token;
}

function validateToken(token) {
  const db = getDb();
  return token && db.data.tokenDB && db.data.tokenDB[token] ? db.data.tokenDB[token] : null;
}

function revokeToken(token) {
  const db = getDb();
  if (db.data.tokenDB && db.data.tokenDB[token]) {
    delete db.data.tokenDB[token];
    db.write();
  }
}

function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hashSync(password, saltRounds);
}

function checkPassword(plain, hashed) {
  return bcrypt.compareSync(plain, hashed);
}

module.exports = { generateToken, validateToken, revokeToken, hashPassword, checkPassword };
