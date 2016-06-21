
import 'babel-register';
import test from 'ava';
import './helpers/setup-browser-env.js';

import {log, notify} from '../public/scripts/utilities';

const consoleLog = console.log;
const consoleGroup = console.group;
const consoleGroupEnd = console.groupEnd;


test.afterEach(t => {
  console.log = consoleLog;
  console.group = consoleGroup;
  console.groupEnd = consoleGroupEnd;
});

test('single log', t=> {
  console.log = function (msg) {
    t.is(msg, 'Hello World');
  };
  log('Hello World');
});

test('group log', t=> {
  console.group = function (msg) {
    t.is(msg, 'Hello');
  };
  console.groupEnd = function (msg) {
    t.is(msg, 'Hello');
  };
  console.log = function (msg) {
    t.is(msg, 'World');
  };
  log('Hello', 'World');
});

test('array log', t=> {
  console.group = function (msg) {
    t.is(msg, 'Hello');
  };
  console.groupEnd = function (msg) {
    t.is(msg, 'Hello');
  };
  console.log = function (msg) {
    t.is(msg, 'World');
  };
  log(['Hello', 'World']);
});

test('notify', t => {

  global.document = require('jsdom').jsdom('<body><div id="notifications"></div></body>');
  let $notifications = global.document.getElementById('notifications');

  t.is($notifications.childElementCount, 0);
  notify('Hello World', 1);
  t.is($notifications.childElementCount, 1);

  return new Promise(function(resolve) {
    setTimeout(() => {
      t.is($notifications.childElementCount, 1);
      let $notification = $notifications.firstChild;
      t.is($notification.classList.contains('fadeOut'), true);
      setTimeout(() => {
        t.is($notifications.childElementCount, 0);
        resolve();
      }, 500)
    }, 2)
  });

});
