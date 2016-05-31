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
const repositories = [];
const repositoriesSet = new Set();
const repositoriesMap = new Map();
const apiUrl = 'https://api.github.com';
const githubUrl = 'https://github.com/';
let accessToken = '';

const repository = {
  url: '',
  placeholderUpdated: false,
  fetchedDetails: false
};

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
  if (repositoriesSet.has(url)) {
    parsedPostMessage('notify', 'That repo was already added');
    return;
  }

  let newRepository = Object.assign({}, repository, {
    prs: [],
    url: url
  });

  repositories.push(newRepository);
  repositoriesSet.add(url);

  parsedPostMessage('drawPlaceholderRepo', newRepository);
  return getRepoDetails(newRepository);
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
    .then(([repoDetails, repoPulls]) => {
      return Promise.all([repoDetails.json(), repoPulls.json()]);
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
      .then(repoPulls => repoPulls.json())
      .then(repoPulls => {
        repository.prs = repoPulls.map(simplifyPR);
      })
      .catch(() => {
        repositoriesSet.delete(url);
        parsedPostMessage('removeRepository', url);
        parsedPostMessage('notify', 'Invalid Url');
        repoStillOnDom = false;
      })
      .then(() => {
        if (repoStillOnDom) {
          parsedPostMessage('updateRepository', repository);
          parsedPostMessage('toggleLoadingRepository', [id, url, false]);
        }
      });
  }

  fetchRepo(repoUrl)
    .then(([{id, name, full_name}, repoPulls]) => {
      /* eslint camelcase:0 */
      repository.id = id;
      repository.name = name;
      repository.fullName = full_name;
      repository.prs = repoPulls.map(simplifyPR);
      repository.fetchedDetails = true;

      repositoriesMap.set(String(id), repository);
    })
    .catch(() => {
      repositoriesSet.delete(url);
      parsedPostMessage('removeRepository', url);
      parsedPostMessage('notify', 'Invalid Url');
      repoStillOnDom = false;
    })
    .then(() => {
      if (repoStillOnDom) {
        parsedPostMessage('updateRepository', repository);
        parsedPostMessage('toggleLoadingRepository', [id, url, false]);
      }
    });
}

/**
 * Foreach through all the repos, getting details for each of them
 * (which in turn updates the DOM with each of them)
 */
function getAllRepoDetails() {
  repositories.forEach(repository => {
    getRepoDetails(repository);
  });
}

/**
 * Given an id, call the getRepoDetails function
 * @param {String} id - id of a repo
 */
function getRepoDetailsById(id) {
  let repository = repositoriesMap.get(id);
  getRepoDetails(repository);
}

/**
 * Unwrap PostMessages
 * @param {Function} fn - function to call
 * @param {Function} msgType - function name
 * @param {String} params - Stringified object that contains a postData prop
 */
function unwrapPostMessage(fn, msgType, params) {
  let parsedParams = JSON.parse(params);
  let postData = parsedParams.postData;
  log(`"${msgType}" called with:`, postData);
  fn(postData);
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

self.addEventListener('message', function({data: [msgType, msgData]}) {
  let msgTypes = {
    getRepoDetails,
    getAllRepoDetails,
    getRepoDetailsById,
    setAccessToken,
    addRepo
  };

  if (msgTypes[msgType]) {
    return unwrapPostMessage(msgTypes[msgType], msgType, msgData);
  }
  log(`"${msgType}" isn't part of the allowed functions`);
});

// Exposing functions for avajs tests, only if module.exports is available
try {
  if (typeof module === 'object' && module.exports) {
    module.exports = {

      repositories,
      repositoriesSet,
      repositoriesMap,
      accessToken,

      setAccessToken,
      simplifyPR,
      addRepo,
      fetchGithubApi,
      fetchRepoDetails,
      fetchRepoPulls,
      fetchRepo,
      getRepoDetails,
      getAllRepoDetails,
      getRepoDetailsById
    };
  }
} catch (e) {
  /**
   * I know I am being extra paranoid by try-catching this. But testing related
   * code should never harm core experiences.
   */
}
