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
var repositories = [];
var apiUrl = '';
var githubUrl = '';
var accessToken = '';

var newPRMap;
var currentPRMap = new Map();
var isPageVisible = true;

var repository = {
  url: '',
  placeholderUpdated: false,
  fetchedDetails: false
};

// Its refreshing!
var peppermint = {
  refreshTimeout: null,
  refreshFn(delay) {
    log(`Refreshing at ${new Date()}`);
    parsedPostMessage('hasRefreshed', '');
    getAllRepoDetails();
    var refreshFn = this.refreshFn;
    this.refreshTimeout = setTimeout(function() {
      refreshFn.call(peppermint, delay);
    }, delay);
  },
  startRefreshing(delay) {
    if (this.refreshTimeout) {
      stopRefreshing();
    }
    var refreshFn = this.refreshFn;
    this.refreshTimeout = setTimeout(function() {
      refreshFn.call(peppermint, delay);
    }, delay);
  },
  stopRefreshing() {
    clearTimeout(this.refreshTimeout);
  }
};

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
  var found = repositories.find(function(repo) {
    return repo.url === url;
  });

  if (found) {
    parsedPostMessage('notify', `"${url}" was already added`);
    return;
  }

  var newRepository = Object.assign({}, repository, {
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
  repositories = repositories.filter(function(repo) {
    return repo.url !== url;
  });
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
    .then(function([repoDetails, prs]) {
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
  var {id, url, fetchedDetails} = repository;
  var repoUrl = url.replace(githubUrl, '');
  var repoStillOnDom = true;

  // If we already got the repository details, lets only fetch pull requests
  if (fetchedDetails) {
    parsedPostMessage('toggleLoadingRepository', [id, url, true]);
    return fetchRepoPulls(repoUrl)
      .then(function(prs) {
        return prs.json();
      })
      .then(function(prs) {
        repository.prs = prs.map(simplifyPR);
      })
      .catch(function() {
        parsedPostMessage('notify', 'There was an error fetching pull requests');
      })
      .then(function() {
        parsedPostMessage('updateRepository', repository);
        parsedPostMessage('toggleLoadingRepository', [id, url, false]);
        return repository;
      });
  }

  return fetchRepo(repoUrl)
    .then(function([{id, name, full_name}, prs]) {
      /* eslint camelcase:0 */
      var simplePrs = prs.map(simplifyPR);
      simplePrs.forEach(function(pr) {
        currentPRMap.set(pr.id, pr);
      });
      repository.id = id;
      repository.name = name;
      repository.fullName = full_name;
      repository.prs = simplePrs;
      repository.fetchedDetails = true;
    })
    .catch(function() {
      removeRepo(url);
      parsedPostMessage('notify', 'Invalid Url');
      repoStillOnDom = false;
    })
    .then(function() {
      if (repoStillOnDom) {
        parsedPostMessage('updateRepository', repository);
        parsedPostMessage('toggleLoadingRepository', [id, url, false]);
      }
      return repository;
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
  fetchedResults.forEach(function(pr, id) {
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
    var size = pullRequests.length;
    var requestWord = size > 1 ? 'requests' : 'request';
    var title = `[OctoShelf] : ${size} new pull ${requestWord}`;
    var body = pullRequests.map(function(pr) {
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
  var ids = pullRequests.map(function(pr) {
    return pr.id;
  });
  parsedPostMessage('animateNewPullRequests', ids);
}

/**
 * Foreach through all the repos, getting details for each of them
 * (which in turn updates the DOM with each of them)
 */
function getAllRepoDetails() {
  var allRepos = repositories.map(function(repository) {
    return getRepoDetails(repository);
  });
  Promise.all(allRepos)
    .then(function(repos) {
      newPRMap = new Map();
      repos.forEach(function(repo) {
        repo.prs.forEach(function(pr) {
          newPRMap.set(pr.id, pr);
        });
      });

      var newPrs = getNewPullRequests(newPRMap, currentPRMap);
      var updateFns = [
        sendNewPullRequestNotification,
        animateNewPullRequests
      ];

      if (newPrs.length) {
        updateFns.forEach(function(fn) {
          fn(newPrs, isPageVisible);
        });
      }

      currentPRMap = newPRMap;
    });
}

/**
 * Given a url, call the getRepoDetails function
 * @param {String} url - url of a repo
 */
function getRepoDetailsByUrl(url) {
  var repository = repositories.find(function(repo) {
    return repo.url === url;
  });
  if (repository) {
    getRepoDetails(repository);
  }
}

/**
 * Unwrap PostMessages
 * @param {Function} fn - function to call
 * @param {Function} msgType - function name
 * @param {String} params - Stringified object that contains a postData prop
 */
function unwrapPostMessage(fn, msgType, params) {
  var parsedParams = JSON.parse(params);
  var postData = parsedParams.postData;
  log(`[Worker] "${msgType}" called with:`, postData);
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

/**
 * If Notifications are permitted, send out a notification.
 * @param {String} notifyTitle - notification title
 * @param {String} body - notification body
 */
function sendNotification(notifyTitle, body) {
  var {permission} = Notification;
  var permissionMap = {
    granted() {
      var notification = new Notification(notifyTitle, {
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

// Before we add any event listeners, lets check to see if we need polyfills
if (typeof Promise === 'undefined') {
  importScripts('/components/es6-promise/es6-promise.min.js');
}

if (typeof fetch === 'undefined') {
  importScripts('/components/fetch/fetch.js');
}

self.addEventListener('message', function({data: [msgType, msgData]}) {
  var msgTypes = {
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
});

// Exposing functions for avajs tests, only if module.exports is available
try {
  if (typeof module === 'object' && module.exports) {
    module.exports = {

      getWorkerState,

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
  }
} catch (e) {
  /**
   * I know I am being extra paranoid by try-catching this. But testing related
   * code should never harm core experiences.
   */
}
