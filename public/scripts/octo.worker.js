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
let isGithubApiAvailable = false;

const repository = {
  url: '',
  placeholderUpdated: false,
  fetchedDetails: false
};

/**
 * Its refreshing :D!
 */
function refreshFn() {
  parsedPostMessage('hasRefreshed', `${new Date()}`);
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
function simplifyPR({id, body, title, html_url: url}) {
  return {id, body, title, url};
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
    return Promise.resolve(null);
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
 * Verify we can contact github's api, and send notifications and flip a bool if we can/can't
 * @return {Promise} fetch - response of if github is available or not
 */
function verifyGithub() {
  let url = apiUrl + (accessToken ? `?access_token=${accessToken}` : '');
  return fetch(url).then(response => {
    if (!response.ok) {
      throw new Error('Something went wrong contacting Github');
    }
    isGithubApiAvailable = true;
    return {isGithubApiAvailable};
  }).catch(err => {
    isGithubApiAvailable = false;
    return {err, isGithubApiAvailable};
  });
}

/**
 * Fetch from the Github API.
 * The access_token is important because it increases the rate limit.
 * @param {String} url - url we are fetching from
 * @param {String} accessToken - token we are passing to Github
 * @return {Promise} GithubApiResponse - response given back by github
 */
function fetchGithubApi(url, accessToken) {
  // Don't even try to reach github if its not available (network issues, etc)
  if (!isGithubApiAvailable) {
    return Promise.resolve(null);
  }

  if (accessToken) {
    url += `?access_token=${accessToken}`;
  }

  return fetch(`${url}`).then(response => response.json());
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
  return Promise.all([fetchRepoDetails(repoUrl), fetchRepoPulls(repoUrl)]);
}

/**
 * Get Details about a repository
 * @param {Object} repository - repo
 * @param {Element} placeholder - temp element
 * @return {Promise.<T>} RepoDetails - repo details
 */
function getRepoDetails(repository) {
  let {url, fetchedDetails} = repository;
  let repoUrl = url.replace(githubUrl, '');
  let repoStillOnDom = true;

  // If we already got the repository details, lets only fetch pull requests
  if (fetchedDetails) {
    parsedPostMessage('toggleLoadingRepository', [url, true]);
    return fetchRepoPulls(repoUrl)
      .then(prs => {
        repository.prs = prs.map(simplifyPR);
      })
      .catch(() => {
        parsedPostMessage('notify', `Error fetching pull requests for: ${url}`);
      })
      .then(() => {
        parsedPostMessage('updateRepository', repository);
        parsedPostMessage('toggleLoadingRepository', [url, false]);
        return repository;
      });
  }

  return fetchRepo(repoUrl)
    .then(([{id, name, full_name: fullName}, prs]) => {
      let simplePrs = prs.map(simplifyPR);
      simplePrs.forEach(pr => {
        currentPRMap.set(pr.id, pr);
      });
      repository.id = id;
      repository.name = name;
      repository.fullName = fullName;
      repository.prs = simplePrs;
      repository.fetchedDetails = true;
      return Promise.resolve(repository);
    })
    .catch(() => {
      parsedPostMessage('notify', 'Invalid Url');
      repoStillOnDom = false;
    })
    .then(() => {
      if (repoStillOnDom) {
        parsedPostMessage('updateRepository', repository);
        parsedPostMessage('toggleLoadingRepository', [url, false]);
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
    pullRequests.filter(pr => pr.url).forEach(pr => {
      let title = `[OctoShelf] New PR: ${pr.title}`;
      let body = pr.body;
      let url = pr.url;
      parsedPostMessage('sendLinkNotification', {title, body, url});
    });
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
 * @return {Promise} repos resolved and current pullRequest map
 */
function getAllRepoDetails() {
  // Check if github's api is available first before all the other api calls
  return verifyGithub()
    .then(() => {
      let allRepos = repositories.map(repository => getRepoDetails(repository));
      return Promise.all(allRepos)
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
          return {currentPRMap, repos};
        });
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
 * @param {String} params - Stringified object that contains a postData prop
 * @return {Function} - whatever function we executed
 */
function unwrapPostMessage(fn, params) {
  let parsedParams = JSON.parse(params);
  let {postData} = parsedParams;
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
 * @param {Object} apiVariables - new api variables
 */
function initAPIVariables(apiVariables) {
  accessToken = apiVariables.accessToken;
  apiUrl = apiVariables.apiUrl;
  githubUrl = apiVariables.githubUrl;

  verifyGithub()
    .then(({err, githubAvailable}) => {
      if (err) {
        parsedPostMessage('notify', err.toString());
      }
      parsedPostMessage('apiInitialized', githubAvailable);
    });
}

/**
 * This function is used almost exclusively for testing. It returns an object
 * that contains the app's state.
 * @return {Object} state
 */
function getWorkerState() {
  return {repositories, accessToken, isPageVisible, currentPRMap, newPRMap};
}

/**
 * Helper Test function that returns back what we set API values to be.
 * @return {Object} Object containing Github API values
 */
function getAPIVariables() {
  return {accessToken, apiUrl, githubUrl};
}

/**
 * Helper Test Function that forces a change on the isGithubApiAvailable variable
 * @param {Boolean} forcedUpdate - new isGithubApiAvailable value
 */
function forceGithubAvailable(forcedUpdate) {
  isGithubApiAvailable = forcedUpdate;
}

/**
 * Event Handler for postMessages from OctoShelf
 * @param {String} msgType - what function does OctoShelf want the worker to execute
 * @param {String} msgData - what data is being passed to that worker
 * @return {Function} the executed function
 */
function postMessageHandler({data: [fnName, msgData]}) {
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

  if (msgTypes[fnName]) {
    return unwrapPostMessage(msgTypes[fnName], msgData);
  }
  log(`"${fnName}" isn't part of the allowed functions`);
}

self.addEventListener('message', postMessageHandler);

// Exposing functions for avajs tests
module.exports = {

  self,
  getWorkerState,
  getAPIVariables,
  initAPIVariables,
  postMessageHandler,

  verifyGithub,
  animateNewPullRequests,
  sendNewPullRequestNotification,
  pageVisibilityChanged,
  forceGithubAvailable,
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
