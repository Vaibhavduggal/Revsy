const bcrypt = require('bcryptjs');

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

function checkPassword(password, hashed) {
  return bcrypt.compareSync(password, hashed);
}

module.exports = { hashPassword, checkPassword };
