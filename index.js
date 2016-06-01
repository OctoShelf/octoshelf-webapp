/**
 * Super-Duper Simple Express
 * Instantiate an express object, and handle `GET /`.
 */

'use strict';

let express = require('express');
let path = require('path');
let ejs = require('ejs');
let app = express();

const githubApi = require('./config.json');

app.use(express.static(path.join(__dirname, 'public')));
app.engine('ejs', ejs.renderFile);

app.get('/', function (req, res) {
  res.render('index.ejs', githubApi);
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});