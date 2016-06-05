
import 'babel-register';
import test from 'ava';
import './helpers/setup-browser-env.js';

const workerPath = '../public/scripts/octo.worker';
const originalFetch = global.fetch;
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
          return [{}, {}];
        }

        return {
          id: getRepoId(),
          name: url,
          fullName: url
        };
      }
    };
    return Promise.resolve(fakeFetchResponse);
  };
  worker = require(workerPath);
});

test.afterEach(t => {
  delete require.cache[require.resolve(workerPath)];
  global.fetch = originalFetch;
});


test('web worker addRepo', t => {

  let state = worker.getWorkerState();
  t.is(state.repositories.length, 0);
  t.is(state.repositoriesMap.has('test'), false);

  worker.addRepo('test');
  state = worker.getWorkerState();
  t.is(state.repositories.length, 1);
  t.is(state.repositoriesMap.has('test'), true);
});

test('web worker removeRepo', t => {

  return worker.addRepo('test').then(() => {
    worker.addRepo('test2').then(() => {
      worker.addRepo('test3').then(() => {

        let state = worker.getWorkerState();
        t.is(state.repositories.length, 3);

        let repoToRemove = state.repositories[1].url;
        worker.removeRepo(repoToRemove);
        state = worker.getWorkerState();
        t.is(state.repositories.length, 2);
        t.is(state.repositoriesMap.has('test2'), false);
      })
    });
  });

});
