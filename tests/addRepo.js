
import test from 'ava';

import {registerWorker} from '../public/scripts/conductor';

let loadAddRepoListeners;
let setInitialFetch;
let initAPIVariables;

/**
 * Return a fake worker. We aren't testing communicating back and forth between
 * the worker and other modules, so all we really need to do is spoof a worker
 * by passing in addEventListener and postMessage functions.
 * @param {Function} addEventListener - gets called when worker is registered
 * @param {Function} postMessage - gets called when modules do a postMessage to conductor
 * @return {Object} Fake Worker
 */
function getWorker(addEventListener, postMessage) {
  return {
    fns: {},
    addEventListener,
    postMessage
  };
}

test.beforeEach(() => {
  let {shh} = require('../public/scripts/utilities');
  shh();
  global.document = require('jsdom').jsdom(`
    <div id="octoshelf">
    <section id="addSection" class="app-prompt">
        <form id="addRepoForm" class="bubble">
            <img class="octoshelf-icon" src="/images/octoshelf-icon.png" alt="OctoShelf, a GitHub powered pull request manager" />
            <div class="addRepoInput-wrapper">
                <div class="addRepoInput-prefix">githubUrl</div>
                <input type="text" id="addRepoInput" class="addRepoInput-input" placeholder="Repository Url" />
            </div>
            <div>
                <a href="#" id="syncAll" class="octicon octicon-sync"></a>
                <a href="#" id="authStatus" class="octicon octicon-alert tokenNeeded-anchor"></a>
            </div>
        </form>
    </section>
    </div>
   `);
  delete require.cache[require.resolve('../public/scripts/addRepo')];
  let addRepo = require('../public/scripts/addRepo');
  loadAddRepoListeners = addRepo.loadAddRepoListeners;
  setInitialFetch = addRepo.setInitialFetch;
  initAPIVariables = addRepo.initAPIVariables;
});

test('initAPIVariables should postMessage api variables to the web worker', t => {
  let addEventListener = () => {};
  let postMessage = (result) => {
    let [fnName, fnData] = result;
    let {postData} = JSON.parse(fnData);
    let { accessToken, apiUrl, githubUrl } = postData;
    t.is(fnName, 'initAPIVariables');
    t.is(accessToken, 'accessToken');
    t.is(apiUrl, 'apiUrl');
    t.is(githubUrl, 'githubUrl');
  };
  let worker = getWorker(addEventListener, postMessage);

  registerWorker(worker);
  initAPIVariables({accessToken: 'accessToken', apiUrl: 'apiUrl', githubUrl: 'githubUrl'});
});

test('initAPIVariables should postMessage defaults if values aren\'t provided', t => {
  let addEventListener = () => {};
  let postMessage = (result) => {
    let [fnName, fnData] = result;
    let {postData} = JSON.parse(fnData);
    let { accessToken, apiUrl, githubUrl } = postData;
    t.is(fnName, 'initAPIVariables');
    t.is(accessToken, '');
    t.is(apiUrl, 'https://api.github.com');
    t.is(githubUrl, 'https://github.com/');
  };
  let worker = getWorker(addEventListener, postMessage);

  registerWorker(worker);
  initAPIVariables({});
});

test('addRepoForm should trigger addRepo on submissions', t => {
  let expectedRepos = ['user/repo3', 'user/repo2', 'user/repo1'];

  function postMessage(message) {
    if (!message) {
      message = [];
    }

    let fnName = message[0];
    let postData = message[1];

    if (fnName === 'addRepo') {
      let fnData = JSON.parse(postData);
      if (expectedRepos) {
        t.is(expectedRepos[expectedRepos.length -1], fnData.postData);
        expectedRepos.pop();
      }
      if (!expectedRepos.length) {
        return t.pass();
      }
    }

    if (this.fns.message) {
      this.fns.message({
        data: [fnName, postData]
      });
    }
  }
  function addEventListener(type, fn) {
    this.fns[type] = fn;
  }

  let worker = getWorker(addEventListener, postMessage);
  registerWorker(worker);

  let {addRepoForm, addRepoInput} = loadAddRepoListeners();

  ['user/repo1', 'user/repo2', 'user/repo3'].forEach(repo => {
    addRepoInput.value = repo;
    let event = new Event('submit');
    addRepoForm.dispatchEvent(event);
    t.is(addRepoInput.value, '');
  });
});

test('addRepoInput input event should clean up the input', t => {

  let {addRepoInput} = loadAddRepoListeners();

  ['https://github.com/user/repo1', 'https://github.com/user/repo1/issues', 'user/repo1/', 'user/repo1/issues', 'user/repo1']
    .forEach(inputVal => {
    addRepoInput.value = inputVal;
    let event = new Event('input');
    addRepoInput.dispatchEvent(event);
    t.is(addRepoInput.value, 'user/repo1');
  });
});

test('syncAll should trigger getAllRepoDetails', t => {

  function postMessage(message) {
    let fnName = message[0];

    if (fnName === 'getAllRepoDetails') {
      return t.pass();
    }
    t.fail();
  }
  function addEventListener(type, fn) {
    this.fns[type] = fn;
  }

  let worker = getWorker(addEventListener, postMessage);
  registerWorker(worker);

  let {syncAll} = loadAddRepoListeners();

  syncAll.click();
})

test('click authStatus should open a window that postMessages back', t => {

  return new Promise(function(resolve) {
    let authStatus;
    let fns = {};
    global.window.addEventListener = (type, fn) => {
      fns[type] = fn;
    };

    global.window.open = () => {
      return {
        postMessage() {
          let event = {
            origin: global.window.location.origin,
            data: 'super_secret_token',
            source: {
              close() {
                t.not(authStatus, global.document.getElementById('authStatus'));
                t.pass();
                resolve();
              }
            }
          };
          fns.message(event);
        }
      }
    };

    function postMessage(message) {
      let fnName = message[0];

      if (fnName === 'setAccessToken') {
        return t.pass();
      }
      t.fail();
    }
    function addEventListener(type, fn) {
      this.fns[type] = fn;
    }

    let worker = getWorker(addEventListener, postMessage);
    registerWorker(worker);

    let listenerElements = loadAddRepoListeners();
    authStatus = listenerElements.authStatus;

    authStatus.click();
  });
});

test('click authStatus should NOT handle a postMessages from a different origin', t => {

  return new Promise(function(resolve) {
    let authStatus;
    let fns = {};
    global.window.addEventListener = (type, fn) => {
      fns[type] = fn;
    };

    global.window.open = () => {
      return {
        postMessage() {
          let event = {
            origin: 'asdf',
            data: 'super_secret_token',
            source: {
              close() {
                t.fail();
              }
            }
          };
          fns.message(event);
          setTimeout(resolve, 50);
        }
      }
    };

    function postMessage(message) {}
    function addEventListener(type, fn) {}

    let worker = getWorker(addEventListener, postMessage);
    registerWorker(worker);

    let listenerElements = loadAddRepoListeners();
    authStatus = listenerElements.authStatus;

    authStatus.click();
  });
});

test('app should not explode if authStatus isn\'t on the DOM', t => {
  global.document = require('jsdom').jsdom(`
    <div id="octoshelf">
    <section id="addSection" class="app-prompt">
        <form id="addRepoForm" class="bubble">
            <img class="octoshelf-icon" src="/images/octoshelf-icon.png" alt="OctoShelf, a GitHub powered pull request manager" />
            <div class="addRepoInput-wrapper">
                <div class="addRepoInput-prefix">githubUrl</div>
                <input type="text" id="addRepoInput" class="addRepoInput-input" placeholder="Repository Url" />
            </div>
            <div>
                <a href="#" id="syncAll" class="octicon octicon-sync"></a>
            </div>
        </form>
    </section>
    </div>
   `);
  delete require.cache[require.resolve('../public/scripts/addRepo')];
  let addRepo = require('../public/scripts/addRepo');
  addRepo.loadAddRepoListeners();
  t.pass();
});

test('setInitialFetch should call appropriate addRepos', t => {

  let expectedRepos = ['user/repo3', 'user/repo2', 'user/repo1'];

  function postMessage(message) {
    if (!message) {
      message = [];
    }

    let fnName = message[0];
    let postData = message[1];

    if (fnName === 'addRepo') {
      let fnData = JSON.parse(postData);
      if (expectedRepos) {
        t.is(expectedRepos[expectedRepos.length -1], fnData.postData);
        expectedRepos.pop();
      }
      if (!expectedRepos.length) {
        return t.pass();
      }
    }

    if (this.fns.message) {
      this.fns.message({
        data: [fnName, postData]
      });
    }
  }
  function addEventListener(type, fn) {
    this.fns[type] = fn;
  }

  let worker = getWorker(addEventListener, postMessage);

  registerWorker(worker);

  let repoStateManager = {
    fetch(addRepo) {
      addRepo('user/repo1');
    }
  };
  let sharedRepos = ['user/repo2', 'user/repo3'];
  setInitialFetch(repoStateManager, sharedRepos);
  worker.postMessage(['apiInitialized', '{}']);
});
