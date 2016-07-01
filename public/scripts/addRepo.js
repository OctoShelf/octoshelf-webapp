/**
 * Add Repo Section - responsible for posting repositories to the web worker
 */

import {getLocalRepos} from './localRepoState';
import {workerPostMessage, registerWorkerEventHandles} from './conductor';
const postMessageToWorker = workerPostMessage('AddRepo');

const addRepoForm = document.getElementById('addRepoForm');
const addRepoInput = document.getElementById('addRepoInput');
const authStatus = document.getElementById('authStatus');
const syncAll = document.getElementById('syncAll');

let githubUrl = 'https://github.com/';
let origin = window.location.origin;

let sharedRepos = [];

/**
 * Only after we have initialized the web worker and verified the github endpoint works,
 * should we attempt to fetch repository data
 */
function apiInitialized() {
  let repos = getLocalRepos();
  repos.forEach(addRepository);
  loadSharedRepos(sharedRepos);
}

/**
 * If the url has the share queryParam, pass in each of the repos.
 * Example url: /?share=org/repo1,org/repo2,org/repo3
 * @param {Array} sharedRepos - repos that came from the share query param
 */
function loadSharedRepos(sharedRepos) {
  sharedRepos.filter(repo => repo).forEach(addRepository);
}

/**
 * Add a repository to the DOM
 * @param {String} url - repo url
 */
function addRepository(url) {
  postMessageToWorker('addRepo', url);
}

/**
 * Add listeners associated with the addRepo section
 * @param {Object} apiVariables - api variables
 * @return {Object} listener elements - elements that we binded listeners to
 */
export function loadAddRepoSection(apiVariables = {}) {
  githubUrl = apiVariables.githubUrl || githubUrl;
  sharedRepos = apiVariables.sharedRepos || sharedRepos;

  addRepoForm.addEventListener('submit', function(event) {
    event.preventDefault();
    addRepository(addRepoInput.value);
    addRepoInput.value = '';
  });
  addRepoInput.addEventListener('input', function() {
    if (addRepoInput.value.includes(githubUrl)) {
      addRepoInput.value = addRepoInput.value.replace(githubUrl, '');
    }
    let slashCount = addRepoInput.value.split('/');
    if (slashCount.length > 1) {
      addRepoInput.value = `${slashCount[0]}/${slashCount[1]}`;
    }
  });
  if (authStatus) {
    authStatus.addEventListener('click', function(event) {
      event.preventDefault();
      let {href} = event.target;
      let authWindow = window.open(href, '', '');
      let timeout = setInterval(function() {
        authWindow.postMessage('fetchToken', origin);
      }, 500);

      window.addEventListener('message', function(event) {
        if (event.origin !== origin) {
          return;
        }

        let token = event.data;
        postMessageToWorker('setAccessToken', token);
        authStatus.parentNode.removeChild(authStatus);
        clearTimeout(timeout);
        event.source.close();
      });
    });
  }
  syncAll.addEventListener('click', function(event) {
    event.preventDefault();
    postMessageToWorker('getAllRepoDetails');
  });

  return {
    addRepoForm,
    addRepoInput,
    authStatus,
    syncAll
  };
}

registerWorkerEventHandles('AddRepo', {
  apiInitialized
});
