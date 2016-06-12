/**
 * Octo Worker
 * All xhr fetching and state management happens here. If you need to make an
 * update to the repository array, then you would do it here by calling a
 * parsedPostMessage from app.js.
 *
 * If you need to make a DOM update (state has changed somehow), then you would
 * call `parsedPostMessage()`
 */

'use strict';

import Peppermint from './peppermint';

let repositories = [];
let apiUrl = '';
let githubUrl = '';
let accessToken = '';

let newPRMap;
let currentPRMap = new Map();
let isPageVisible = true;

const repository = {
  url: '',
  placeholderUpdated: false,
  fetchedDetails: false
};

/**
 * Its refreshing :D!
 */
function refreshFn() {
  log(`Refreshing at ${new Date()}`);
  parsedPostMessage('hasRefreshed', '');
  getAllRepoDetails();
}
// the new is unnecessary, but linting gets mad
const peppermint = new Peppermint(refreshFn);

/**
 * Start the refreshing process
 * @param {Number} delay -  delay between each refresh
 */
function startRefreshing(delay) {
  peppermint.startRefreshing(delay);
}

/**
 * End the refreshing process
 */
function stopRefreshing() {
  peppermint.stopRefreshing();
}

/**
 * Set the access token for future github api requests
 * @param {String} newAccessToken - new access token from server
 */
function setAccessToken(newAccessToken) {
  accessToken = newAccessToken;
}

/**
 * Given a PR Object (from Github's API), return a slimmer version
 * @param {Object} PullRequest - Pull Request Object from the github api
 * @return {Object} simplePullRequest - smaller, cleaner pull request object
 */
function simplifyPR({id, title, html_url: url}) {
  return {id, title, url};
}

/**
 * Add a Repo to our repos array
 * @param {String} url - Url of the repo we are adding
 * @return {Promise} repoDetails - repo's details and open prs
 */
function addRepo(url) {
  // Clean the url (just in case bad urls got through)
  url = url.replace(/\/+$/, '');

  if (repositories.find(repo => repo.url === url)) {
    parsedPostMessage('notify', `"${url}" was already added`);
    return;
  }

  let newRepository = Object.assign({}, repository, {
    prs: [],
    url: url
  });

  repositories.push(newRepository);

  parsedPostMessage('drawPlaceholderRepo', newRepository);
  return getRepoDetails(newRepository);
}

/**
 * Remove the repo from the dom
 * @param {String} url - url of the repo we are removing
 */
function removeRepo(url) {
  repositories = repositories.filter(repo => repo.url !== url);
  parsedPostMessage('removeRepository', url);
}

/**
 * Fetch from the Github API.
 * The access_token is important because it increases the rate limit.
 * @param {String} url - url we are fetching from
 * @param {String} accessToken - token we are passing to Github
 * @return {Promise} GithubApiResponse - response given back by github
 */
function fetchGithubApi(url, accessToken) {
  if (!accessToken) {
    return fetch(`${url}`);
  }

  return fetch(`${url}?access_token=${accessToken}`);
}

/**
 * Fetch Details about a Repo (title, etc)
 * @param {String} repoUrl - repo url
 * @return {Promise} response - Repo details
 */
function fetchRepoDetails(repoUrl) {
  return fetchGithubApi(`${apiUrl}/repos/${repoUrl}`, accessToken);
}

/**
 * Fetch a Repo's Pull Requests
 * @param {String} repoUrl - repo url
 * @return {Promise} response - Pull Request and their details
 */
function fetchRepoPulls(repoUrl) {
  return fetchGithubApi(`${apiUrl}/repos/${repoUrl}/pulls`, accessToken);
}

/**
 * Fetch a Repo's details and open pull requests
 * @param {String} repoUrl - Repo Url
 * @return {Promise.<T>} [repoDetails, repoPullRequests]
 */
function fetchRepo(repoUrl) {
  return Promise.all([fetchRepoDetails(repoUrl), fetchRepoPulls(repoUrl)])
    .then(([repoDetails, prs]) => {
      return Promise.all([repoDetails.json(), prs.json()]);
    });
}

/**
 * Get Details about a repository
 * @param {Object} repository - repo
 * @param {Element} placeholder - temp element
 * @return {Promise.<T>} RepoDetails - repo details
 */
function getRepoDetails(repository) {
  let {id, url, fetchedDetails} = repository;
  let repoUrl = url.replace(githubUrl, '');
  let repoStillOnDom = true;

  // If we already got the repository details, lets only fetch pull requests
  if (fetchedDetails) {
    parsedPostMessage('toggleLoadingRepository', [id, url, true]);
    return fetchRepoPulls(repoUrl)
      .then(prs => prs.json())
      .then(prs => {
        repository.prs = prs.map(simplifyPR);
      })
      .catch(() => {
        parsedPostMessage('notify', 'Error fetching pull requests');
      })
      .then(() => {
        parsedPostMessage('updateRepository', repository);
        parsedPostMessage('toggleLoadingRepository', [id, url, false]);
        return repository;
      });
  }

  return fetchRepo(repoUrl)
    .then(([{id, name, full_name}, prs]) => {
      /* eslint camelcase:0 */
      let simplePrs = prs.map(simplifyPR);
      simplePrs.forEach(pr => {
        currentPRMap.set(pr.id, pr);
      });
      repository.id = id;
      repository.name = name;
      repository.fullName = full_name;
      repository.prs = simplePrs;
      repository.fetchedDetails = true;
      return Promise.resolve(repository);
    })
    .catch(() => {
      removeRepo(url);
      parsedPostMessage('notify', 'Invalid Url');
      repoStillOnDom = false;
    })
    .then(() => {
      if (repoStillOnDom) {
        parsedPostMessage('updateRepository', repository);
        parsedPostMessage('toggleLoadingRepository', [id, url, false]);
      }
      return Promise.resolve(repository);
    });
}

/**
 * Return an array of new pull requests
 * @param {Map} fetchedResults - current map of pull requests
 * @param {Map} previousResults - previous map of pull requests
 * @return {Array} new pull requests
 */
function getNewPullRequests(fetchedResults, previousResults) {
  var pullRequests = [];
  fetchedResults.forEach((pr, id) => {
    if (!previousResults.has(id)) {
      pullRequests.push(pr);
    }
  });
  return pullRequests;
}

/**
 * Send out a notification listing out all the new open pull requests
 * @param {Array} pullRequests - array of new pull requests
 * @param {Boolean} isPageVisible - toggle if we want to show the notification
 */
function sendNewPullRequestNotification(pullRequests, isPageVisible) {
  if (!isPageVisible) {
    let size = pullRequests.length;
    let requestWord = size > 1 ? 'requests' : 'request';
    let title = `[OctoShelf] : ${size} new pull ${requestWord}`;
    let body = pullRequests.map(pr => {
      return '• ' + (pr.url || '').replace(githubUrl, '');
    }).join('\n');
    sendNotification(title, body);
  }
}

/**
 * Pull out the ids from the pull request, and toss them to over to OctoShelf
 * @param {Array} pullRequests - array of new pull requests
 * @param {Boolean} isPageVisible - we only want to animate on active pages
 */
function animateNewPullRequests(pullRequests) {
  let ids = pullRequests.map(pr => pr.id);
  parsedPostMessage('animateNewPullRequests', ids);
}

/**
 * Foreach through all the repos, getting details for each of them
 * (which in turn updates the DOM with each of them)
 */
function getAllRepoDetails() {
  let allRepos = repositories.map(repository => getRepoDetails(repository));
  Promise.all(allRepos)
    .then(repos => {
      newPRMap = new Map();
      repos.forEach(repo => repo.prs.forEach(pr => newPRMap.set(pr.id, pr)));

      let newPrs = getNewPullRequests(newPRMap, currentPRMap);
      let updateFns = [
        sendNewPullRequestNotification,
        animateNewPullRequests
      ];

      if (newPrs.length) {
        updateFns.forEach(fn => fn(newPrs, isPageVisible));
      }

      currentPRMap = newPRMap;
    });
}

/**
 * Given a url, call the getRepoDetails function
 * @param {String} url - url of a repo
 * @return {Promse} repository or null
 */
function getRepoDetailsByUrl(url) {
  let repository = repositories.find(repo => repo.url === url);
  if (repository) {
    return getRepoDetails(repository);
  }
  return Promise.resolve(null);
}

/**
 * Unwrap PostMessages
 * @param {Function} fn - function to call
 * @param {Function} msgType - function name
 * @param {String} params - Stringified object that contains a postData prop
 * @return {Function} - whatever function we executed
 */
function unwrapPostMessage(fn, msgType, params) {
  let parsedParams = JSON.parse(params);
  let postData = parsedParams.postData;
  log(`[Worker] "${msgType}" called with:`, postData);
  return fn(postData);
}

/**
 * This log function simply does a postMessage to the app
 */
function log() {
  parsedPostMessage('log', [...arguments]);
}

/**
 * Send a Parsed Post Message
 * @param {String} messageType - function we will attempt to call
 * @param {*} postData - Some data that we will wrap into a stringified object
 */
function parsedPostMessage(messageType, postData) {
  self.postMessage([messageType, JSON.stringify({postData})]);
}

/**
 * If Notifications are permitted, send out a notification.
 * @param {String} notifyTitle - notification title
 * @param {String} body - notification body
 */
function sendNotification(notifyTitle, body) {
  let {permission} = Notification;
  let permissionMap = {
    granted() {
      let notification = new Notification(notifyTitle, {
        body,
        icon: '/images/octoshelf-icon-dark.jpg'
      });
      setTimeout(notification.close.bind(notification), 5000);
    },
    denied() {
      // no-op
    }
  };

  if (permissionMap[permission]) {
    permissionMap[permission]();
  }
}

/**
 * The user has tabbed in/out of OctoShelf, toggle notifications
 * @param {Boolean} isVisible - is the user currently looking at OctoShelf
 */
function pageVisibilityChanged(isVisible) {
  isPageVisible = isVisible;
  if (newPRMap) {
    currentPRMap = newPRMap;
  }
}

/**
 * Init a bunch of api variables so we can access github's api
 * @param {String} initAccessToken - github access token
 * @param {String} initApiUrl - github api url, which differs for corp accounts
 * @param {String} initGithubUrl - github root url
 */
function initAPIVariables({initAccessToken, initApiUrl, initGithubUrl}) {
  accessToken = initAccessToken;
  apiUrl = initApiUrl;
  githubUrl = initGithubUrl;
}

/**
 * This function is used almost exclusively for testing. It returns an object
 * that contains the app's state.
 * @return {Object} state
 */
function getWorkerState() {
  return {repositories, accessToken};
}

/**
 * Helper Test function that returns back what we set API values to be.
 * @return {Object} Object containing Github API values
 */
function getAPIVariables() {
  return {accessToken, apiUrl, githubUrl};
}

/**
 * Event Handler for postMessages from OctoShelf
 * @param {String} msgType - what function does OctoShelf want the worker to execute
 * @param {String} msgData - what data is being passed to that worker
 * @return {Function} the executed function
 */
function postMessageHandler({data: [msgType, msgData]}) {
  let msgTypes = {
    startRefreshing,
    stopRefreshing,
    getRepoDetails,
    getAllRepoDetails,
    getRepoDetailsByUrl,
    setAccessToken,
    initAPIVariables,
    pageVisibilityChanged,
    removeRepo,
    addRepo
  };

  if (msgTypes[msgType]) {
    return unwrapPostMessage(msgTypes[msgType], msgType, msgData);
  }
  log(`"${msgType}" isn't part of the allowed functions`);
}

self.addEventListener('message', postMessageHandler);

// Exposing functions for avajs tests, only if module.exports is available
module.exports = {

  self,
  getWorkerState,
  getAPIVariables,
  initAPIVariables,
  postMessageHandler,

  setAccessToken,
  simplifyPR,
  addRepo,
  removeRepo,
  fetchGithubApi,
  fetchRepoDetails,
  fetchRepoPulls,
  fetchRepo,
  getRepoDetails,
  getAllRepoDetails,
  getRepoDetailsByUrl
};
