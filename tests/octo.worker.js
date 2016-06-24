
import test from 'ava';

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
            id: 'id1', title: 'title', html_url: 'url'
          }, {
            id: 'id2', title: 'title', html_url: 'url'
          }]);
        }

        return Promise.resolve({
          id: getRepoId(),
          name: url,
          fullName: url
        });
      }
    };
    fakeFetchResponse.ok = true;
    return Promise.resolve(fakeFetchResponse);
  };
  delete require.cache[require.resolve(workerPath)];
  worker = require(workerPath);
});


test('setting worker variables', t => {
  worker.initAPIVariables({ accessToken: 'a', apiUrl: 'b', githubUrl: 'c'});
  let state = worker.getAPIVariables();
  t.deepEqual(state, {accessToken: 'a', apiUrl: 'b', githubUrl: 'c'});
});

test('setting worker variables without accessToken', t => {
  worker.initAPIVariables({ apiUrl: 'b', githubUrl: 'c'});
  let state = worker.getAPIVariables();
  t.deepEqual(state, {accessToken: undefined, apiUrl: 'b', githubUrl: 'c'});
});

test('should notify if github is not available', t => {
  global.fetch = (url) => {
    let response = {
      url,
      ok: false
    };
    return Promise.resolve(response);
  };
  worker.self.postMessage = function([messageType, msgDataString]) {
    if (messageType === 'notify') {
      let {postData} = JSON.parse(msgDataString);
      t.is(postData, 'Something went wrong contacting Github');
      t.pass();
    }
  };
  worker.verifyGithub();
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

test('web worker addRepo (with github available)', t => {
  return new Promise(function(resolve) {
    worker.forceGithubAvailable(true);
    let state = worker.getWorkerState();
    t.is(state.repositories.length, 0);
    t.is(state.repositories.find(repo => repo.url ==='test') !== undefined, false);

    worker.self.postMessage = function([messageType, msgDataString]) {
      if (messageType === 'drawPlaceholderRepo') {
        let {postData} = JSON.parse(msgDataString);
        t.is(postData.url, 'test');
        t.is(state.repositories.length, 1);
        t.is(state.repositories.find(repo => repo.url ==='test') !== undefined, true);
        resolve();
      }
    };
    worker.addRepo('test');
  });
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
    accessToken: 'asdf',
    apiUrl: 'https://api.github.com',
    githubUrl: 'https://github.com/'
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

test('getAllRepoDetails', t => {
  delete require.cache[require.resolve(workerPath)];
  let worker = require(workerPath);
  worker.forceGithubAvailable(true);
  worker.addRepo('repo1')
    .then(() => worker.addRepo('repo2'))
    .then(() => worker.addRepo('repo3'))
    .then(() => worker.getAllRepoDetails('getRepoDetailsByUrl'))
    .then(({currentPRMap}) => {
      t.is(currentPRMap.size, 2);
      worker.pageVisibilityChanged(true);
      let state = worker.getWorkerState();
      t.is(state.currentPRMap, state.newPRMap);
    });
});

test('pageVisibilityChanged', t => {
  let state = worker.getWorkerState();
  t.is(state.isPageVisible, true);

  worker.pageVisibilityChanged(false);
  state = worker.getWorkerState();
  t.is(state.isPageVisible, false);

  worker.pageVisibilityChanged(true);
  state = worker.getWorkerState();
  t.is(state.isPageVisible, true);
});

test('send Pull Request Notification', t => {
  worker.self.postMessage = function([messageType, msgDataString]) {
    if (messageType === 'sendLinkNotification') {
      let {postData} = JSON.parse(msgDataString);
      let {title, body, url} = postData;
      t.is(title, '[OctoShelf] New PR: pr title');
      t.is(body, 'pr body');
      t.is(url, 'http://github.com/urlA');
      t.pass();
    }
  };

  let pullRequests = [{title: 'pr title', body: 'pr body', url: 'http://github.com/urlA'}];
  worker.sendNewPullRequestNotification(pullRequests, false);
});

test('send Pull Requests Notification', t => {

  // in reverse order, like a stack
  let expectedOutput = [
    {title: '[OctoShelf] New PR: title2', body: 'body2', url: 'http://github.com/url2'},
    {title: '[OctoShelf] New PR: title1', body: 'body1', url: 'http://github.com/url1'}
  ];

  worker.self.postMessage = function([messageType, msgDataString]) {
    if (messageType === 'sendLinkNotification') {
      let {postData} = JSON.parse(msgDataString);
      let {title, body, url} = postData;
      let expected = expectedOutput.pop();
      t.is(title, expected.title);
      t.is(body, expected.body);
      t.is(url, expected.url);
      t.pass();
    }
  };

  let pullRequests = [
    {title: 'title1', body: 'body1', url: 'http://github.com/url1'},
    {title: 'title2', body: 'body2', url: 'http://github.com/url2'}
  ];
  worker.sendNewPullRequestNotification(pullRequests, false);
});

test('do not send Pull Requests Notification if page is visible', t => {

  worker.self.postMessage = function([messageType]) {
    if (messageType === 'sendLinkNotification') {
      t.fail();
    }
  };

  let pullRequests = [{title: 'title1', body: 'body1', url: 'http://github.com/url1'}];
  worker.sendNewPullRequestNotification(pullRequests, true);
});

test('animateNewPullRequests', t => {
  worker.self.postMessage = function([messageType, msgDataString]) {
    if (messageType === 'animateNewPullRequests') {
      let {postData} = JSON.parse(msgDataString);
      t.is(postData[0], 'cow');
      t.is(postData[1], 'bell');
      t.pass();
    }
  };
  let pullRequests = [{id: 'cow', url: 'http://github.com/urlA'}, {id: 'bell', url: 'http://github.com/urlB'}];
  worker.animateNewPullRequests(pullRequests);
});
