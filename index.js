/**
 * Super-Duper Simple Express
 * Instantiate an express object, and handle `GET /`.
 */

'use strict';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
if (typeof Object.assign != 'function') {
  Object.assign = function(target) {
    'use strict';
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }

    target = Object(target);
    for (var index = 1; index < arguments.length; index++) {
      var source = arguments[index];
      if (source != null) {
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
    }
    return target;
  };
}

let express = require('express');
let path = require('path');
let ejs = require('ejs');
let request = require('request');
let config = require('./config/config.json');
let session = require('express-session');
const app = express();

// Setup webpack dev middleware
var webpackDevMiddleware = require('webpack-dev-middleware'),
  webpack = require('webpack'),
  webpackConfig = require('./webpack.config.js'),
  compiler = webpack(webpackConfig);

app.use(webpackDevMiddleware(compiler, {
  publicPath: '/'
}));

const github_client_id = process.env.GITHUB_CLIENT_ID || '';
const github_client_secret = process.env.GITHUB_CLIENT_SECRET || '';
const personal_access_token = process.env.PERSONAL_ACCESS_TOKEN || '';
const showAppDescription = process.env.SHOW_APP_DESCRIPTION || false;

const tokenPayload = {
  "client_id": github_client_id,
  "client_secret": github_client_secret
};
const accessTokenOptions = {
  url: config.githubTokenUrl,
  method: 'POST',
  json: true,
  headers: {
    Accept: 'application/json'
  }
};

config.githubAuthUrl += '?client_id=' + github_client_id

app.use(express.static(path.join(__dirname, 'public')));
app.engine('ejs', ejs.renderFile);
app.use(session({
  secret: 'super secret keyboard cat'
}));

function getAccessToken(req) {
  return personal_access_token || req.session.accessToken || '';
}

app.get('/', function (req, res) {
  let query = req.query || {};
  let sharedRepos = query.share || '';
  let accessToken = getAccessToken(req);
  let data = Object.assign({}, config, {
    accessToken: accessToken,
    showAppDescription: showAppDescription,
    sharedRepos: sharedRepos
  });
  res.render('index.ejs', data);
});

app.get('/auth', function (req, res) {
  let query = req.query;
  let code = query.code || '';
  let accessToken = getAccessToken(req);
  let data = Object.assign({}, {
    accessToken: accessToken
  });
  if (code) {
    let body = Object.assign({}, tokenPayload, {
      code: code
    });
    let opts = Object.assign({}, accessTokenOptions, {
      body: body
    });
    return request(opts, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        accessToken = body.access_token;
        req.session.accessToken = accessToken;
        data.accessToken = accessToken;
      }
      res.render('auth.ejs', data);
    });
  }
  res.render('auth.ejs', data);
});

let port = process.env.PORT || 5000;
app.listen(port, function () {
  console.log('OctoShelf is starting');
});