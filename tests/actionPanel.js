
import 'babel-register';
import test from 'ava';
import './helpers/setup-browser-env.js';

import {hasRefreshed, updateShareLink} from '../public/scripts/actionPanel';


test('hasRefreshed', t => {

  global.document = require('jsdom').jsdom('<body><div id="refreshRateToggle"></div></body>');
  let refreshRateToggle = global.document.getElementById('refreshRateToggle');

  t.is(refreshRateToggle.classList.contains('hasRefreshed'), false);
  hasRefreshed();
  t.is(refreshRateToggle.classList.contains('hasRefreshed'), true);

  return new Promise(function(resolve) {
    setTimeout(() => {
      t.is(refreshRateToggle.classList.contains('hasRefreshed'), false);
      resolve();
    }, 500)
  });

});


test('updateShareLink', t => {

  global.document = require('jsdom').jsdom(`<body><div id="repoSection"></div><textarea id="shareUrl"></textarea></body>`);

  let repoSection = document.getElementById('repoSection');
  let shareUrl = document.getElementById('shareUrl');
  updateShareLink('http://localhost:5000');

  t.is(shareUrl.value, 'http://localhost:5000');

  let repo = document.createElement('div');
  repo.setAttribute('data-url', 'test/test');
  repoSection.appendChild(repo);

  updateShareLink('http://localhost:5000');
  t.is(shareUrl.value, 'http://localhost:5000?share=test/test');

  repo = document.createElement('div');
  repo.setAttribute('data-url', 'test2/test2');
  repoSection.appendChild(repo);

  updateShareLink('http://localhost:5000');
  t.is(shareUrl.value, 'http://localhost:5000?share=test/test,test2/test2');
});