const path = require('path');
const express = require('express');
const session = require('express-session');
const { PATHS } = require('./config');

const app = express();

app.use(express.json());
app.use(session({
  secret: 'yesdocu-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7*24*3600*1000 }
}));

// Static front
app.use(express.static(PATHS.PUBLIC));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/hotfolders', require('./routes/hotfolders'));
app.use('/impressions', require('./routes/impressions'));
app.use('/reimpressions', require('./routes/reimpressions'));
app.use('/suivi', require('./routes/suivi'));

module.exports = app;