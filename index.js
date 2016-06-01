/**
 * Super-Duper Simple Express
 * Instantiate an express object, and handle `GET /`.
 */

'use strict';

let express = require('express');
let path = require('path');
let ejs = require('ejs');
let request = require('request');
let githubApi = require('./config/githubApi.json');
const app = express();

const github_client_id = process.env.GITHUB_CLIENT_ID || '';
const github_client_secret = process.env.GITHUB_CLIENT_SECRET || '';
const tokenPayload = {
  "client_id": github_client_id,
  "client_secret": github_client_secret
};
const requestAccessTokenOptions = {
  url: githubApi.tokenUrl + '?client_id=' + github_client_id,
  method: 'POST',
  json: true,
  headers: {
    Accept: 'application/json'
  }
};

app.use(express.static(path.join(__dirname, 'public')));
app.engine('ejs', ejs.renderFile);

app.get('/', function (req, res) {
  let query = req.query;
  let code = query.code || '';
  if (code) {
    let payload = Object.assign({}, tokenPayload, { code });
    let opts = Object.assign({}, requestAccessTokenOptions, { body: payload});
    return request(opts, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log(body); // Print the google web page.
      }
      console.log(body);
      res.render('index.ejs', githubApi);
    });
  }
  res.render('index.ejs', githubApi);
});

app.listen(3000, function () {
  console.log('OctoShelf, http://localhost:3000/');
});