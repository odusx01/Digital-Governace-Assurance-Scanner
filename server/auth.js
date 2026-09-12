'use strict';

const bcrypt = require('bcryptjs');
const session = require('express-session');

const SESSION_SECRET = process.env.SESSION_SECRET || 'consentlens-dev-secret';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function comparePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

function authMiddleware(req, res, next) {
  if (req.session && req.session.userId) {
    res.locals.user = { id: req.session.userId, email: req.session.userEmail };
  } else {
    res.locals.user = null;
  }
  next();
}

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

module.exports = {
  hashPassword,
  comparePassword,
  requireAuth,
  authMiddleware,
  sessionMiddleware,
};
