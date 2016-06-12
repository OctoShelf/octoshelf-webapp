
import 'babel-register';
import test from 'ava';
import './helpers/setup-browser-env.js';

const workerPath = '../public/scripts/octo.worker';
let worker;

function getRepoId() {
  return Date.now() + ~~(Math.random() * 100);
}

test.beforeEach(t => {
  global.self = {
    addEventListener: () => {},
    postMessage: () => {}
  };
  // Mock out fetch
  global.fetch = function(url) {
    let fakeFetchResponse = {
      json() {

        if (url.includes('/pulls')) {
          return Promise.resolve([{
            id: 'id', title: 'title', html_url: 'url'
          }, {
            id: 'id', title: 'title', html_url: 'url'
          }]);
        }

        return Promise.resolve({
          id: getRepoId(),
          name: url,
          fullName: url
        });
      }
    };
    return Promise.resolve(fakeFetchResponse);
  };
  worker = require(workerPath);
});

test.afterEach(t => {
  delete require.cache[require.resolve(workerPath)];
});


test('setting worker variables', t => {
  worker.initAPIVariables({ initAccessToken: 'a', initApiUrl: 'b', initGithubUrl: 'c'});
  let state = worker.getAPIVariables();
  t.deepEqual(state, {accessToken: 'a', apiUrl: 'b', githubUrl: 'c'});
});

test('setting accessToken', t => {
  worker.setAccessToken('hello world');
  let state = worker.getAPIVariables();
  t.is(state.accessToken, 'hello world');
});

test('start refreshing log', t => {
  global.self.postMessage = function([msgType, msgData]) {
    t.is(msgType, 'log');
    t.is(msgData, '{"postData":["[Worker] \\"startRefreshing\\" called with:",25]}');
  };
  let postMessageHandler = worker.postMessageHandler;
  postMessageHandler({data: ['startRefreshing', '{"postData": 25}']});
});

test('stop refreshing log', t => {
  global.self.postMessage = function([msgType, msgData]) {
    t.is(msgType, 'log');
    t.is(msgData, '{"postData":["[Worker] \\"stopRefreshing\\" called with:",25]}');
  };
  let postMessageHandler = worker.postMessageHandler;
  postMessageHandler({data: ['stopRefreshing', '{"postData": 25}']});
});

test('should not allow an invalid postMessage through', t => {
  global.self.postMessage = function([msgType, msgData]) {
    t.is(msgType, 'log');
    t.is(msgData, "{\"postData\":[\"\\\"getWorkerState\\\" isn't part of the allowed functions\"]}");
  };
  let postMessageHandler = worker.postMessageHandler;
  postMessageHandler({data: ['getWorkerState', '{"postData": ""}']});
});

test('web worker addRepo', t => {

  let state = worker.getWorkerState();
  t.is(state.repositories.length, 0);
  t.is(state.repositories.find(repo => repo.url ==='test') !== undefined, false);

  worker.addRepo('test');
  state = worker.getWorkerState();
  t.is(state.repositories.length, 1);
  t.is(state.repositories.find(repo => repo.url ==='test') !== undefined, true);
});

test('web worker add duplicate', t => {
  let state = worker.getWorkerState();
  t.is(state.repositories.length, 0);
  t.is(state.repositories.find(repo => repo.url ==='test') !== undefined, false);

  worker.addRepo('test');
  worker.addRepo('test');
  state = worker.getWorkerState();
  t.is(state.repositories.length, 1);
  t.is(state.repositories.find(repo => repo.url ==='test') !== undefined, true);
});

test('web worker removeRepo', t => {
  delete require.cache[require.resolve(workerPath)];
  let worker = require(workerPath);

  worker.initAPIVariables({
    initAccessToken: 'asdf',
    initApiUrl: 'https://api.github.com',
    initGithubUrl: 'https://github.com/'
  });
  worker.addRepo('test').then(() => {
    let state = worker.getWorkerState();
    t.is(state.repositories.length, 1);
    t.is(state.repositories.find(repo => repo.url ==='test') === undefined, false);

    let repoToRemove = state.repositories[0].url;
    worker.removeRepo(repoToRemove);
    state = worker.getWorkerState();
    t.is(state.repositories.length, 0);
    t.is(state.repositories.find(repo => repo.url ==='test') === undefined, true);
  });
});

test('getRepoDetailsByUrl', t => {
  delete require.cache[require.resolve(workerPath)];
  let worker = require(workerPath);
  worker.addRepo('getRepoDetailsByUrl').then(() => {
    worker.getRepoDetailsByUrl('getRepoDetailsByUrl').then(repo => {
      t.is(repo.url, 'getRepoDetailsByUrl');
    });
  });
});
