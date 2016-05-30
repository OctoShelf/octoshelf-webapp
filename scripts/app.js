
let repoSection = document.getElementById('repoSection');
let authStatus = document.getElementById('authStatus');
let syncAll = document.getElementById('syncAll');
let addRepoForm = document.getElementById('addRepoForm');
let addRepoInput = document.getElementById('addRepoInput');
let notifications = document.getElementById('notifications');

let authToken = document.getElementById('github_authToken').value;
// let oathUrl = document.getElementById('github_oathUrl').value;
// let clientId = document.getElementById('github_clientId').value;

let stylesheetHelper = document.createElement("style");
document.head.appendChild(stylesheetHelper);

// Event Listeners
let resizeDebounce;
addRepoForm.addEventListener('submit', function(event) {
  event.preventDefault();
  addRepo(addRepoInput.value);
  addRepoInput.value = '';
});
syncAll.addEventListener('click', function(event) {
  event.preventDefault();
  // We will be moving things around shortly, so temp ignoring lint error
  /* eslint no-use-before-define:0 */
  repositories.forEach(repository => getRepoDetails(repository));
});
window.addEventListener('resize', function() {
  if (resizeDebounce) {
    clearTimeout(resizeDebounce);
  }

  resizeDebounce = setTimeout(function(innerHeight, innerWidth) {
    updateBubbleStyles(innerHeight, innerWidth);
  }, 60, window.innerHeight, window.innerWidth);
});
repoSection.addEventListener('click', function(event) {
  let {action, id} = event.target && event.target.dataset;

  if (action === 'refresh') {
    event.preventDefault();
    let repository = repositoriesMap.get(id);
    return getRepoDetails(repository);
  }
});

/**
 * Update the access token (and UI)
 * @param {String} newAccessToken - new access token
 */
function updateAccessToken(newAccessToken) {
  if (!newAccessToken) {
    return;
  }
  setAccessToken(newAccessToken);
  authStatus.classList.remove('octicon-issue-reopened');
  authStatus.classList.add('octicon-issue-closed');
}

const repositories = [];
const repositoriesSet = new Set();
const repositoriesMap = new Map();
const apiUrl = 'https://api.github.com';
const githubUrl = 'https://github.com/';
const bubbleSize = 150;
const centerDistance = 250;
const prResizeThreshold = 8;
let accessToken = '';

let repository = {
  url: '',
  placeholderUpdated: false,
  fetchedDetails: false
};

/**
 * Update Bubble Styles by injecting new css rules
 * @param {Number} innerHeight - height of the window
 * @param {Number} innerWidth - width of the window
 */
function updateBubbleStyles(innerHeight, innerWidth) {
  let bubbleModify = bubbleSize / 2;
  let top = (innerHeight / 2) - bubbleModify;
  let left = (innerWidth / 2) - bubbleModify;

  while (stylesheetHelper.sheet.rules.length) {
    stylesheetHelper.sheet.removeRule(0);
  }
  let size = bubbleSize;
  let cssRule = `top:${top}px;left:${left}px;height:${size}px;width:${size}px`;
  let afterRule = `top: ${size - 1}px;`;
  stylesheetHelper.sheet.insertRule(`.bubble {${cssRule}}`, 0);
  stylesheetHelper.sheet.insertRule(`.repository:after {${afterRule}}`, 0);
}

/**
 * Impl note: I'm putting this IIFE here temporarily so that I am not accessing
 * undeclared variables. It should NOT be pulled into the WebWorker
 */
(function init(innerHeight, innerWidth) {
  updateBubbleStyles(innerHeight, innerWidth);
  updateAccessToken(authToken.value);
})(window.innerHeight, window.innerWidth);

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
function simplifyPR({id, title, body, html_url: url}) {
  return {id, title, body, url};
}

/**
 * Add a Repo to our repos array
 * @param {String} url - Url of the repo we are adding
 * @return {Promise} repoDetails - repo's details and open prs
 */
function addRepo(url) {
  if (repositoriesSet.has(url)) {
    notify('That repo was already added');
    return;
  }

  let newRepository = Object.assign({}, repository, {
    prs: [],
    url: url
  });

  repositories.push(newRepository);
  repositoriesSet.add(url);

  let placeholder = drawPlaceholderRepo(newRepository);
  return getRepoDetails(newRepository, placeholder);
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
function getRepoDetails(repository, placeholder) {
  let {id, url, fetchedDetails} = repository;
  let repoUrl = url.replace(githubUrl, '');

  // If we already got the repository details, lets only fetch pull requests
  if (fetchedDetails) {
    let article = document.getElementById(id);
    article.classList.add('loading');

    return fetchRepoPulls(repoUrl)
      .then(repoPulls => repoPulls.json())
      .then(repoPulls => {
        repository.prs = repoPulls.map(simplifyPR);
      })
      .catch(() => {
        repoSection.removeChild(placeholder);
        repositoriesSet.delete(url);
        notify('Invalid Url');
      })
      .then(() => {
        updateRepository(repository, placeholder);
      })
      .then(updateRotations);
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
      repoSection.removeChild(placeholder);
      repositoriesSet.delete(url);
      notify('Invalid Url');
    })
    .then(() => {
      updateRepository(repository, placeholder);
    })
    .then(updateRotations);
}

/**
 * Draw a simple placeholder repo into the repoSection.
 * Later we will fill up the drawn element with more data.
 * @param {Object} Repo - Repo Object
 * @return {Element} article - placeholder element
 */
function drawPlaceholderRepo({url}) {
  let lastRepo = repoSection.lastElementChild;

  let article = document.createElement('article');
  article.setAttribute('class', 'bubble repository loading');

  let repositoryInner = document.createElement('div');
  repositoryInner.setAttribute('class', 'repositoryInner');

  let header = document.createElement('header');
  let title = document.createElement('span');
  title.setAttribute('class', 'repo-title');

  let sync = document.createElement('a');
  sync.setAttribute('href', '#');
  sync.setAttribute('class', 'octicon octicon-sync');
  sync.setAttribute('data-action', 'refresh');
  sync.setAttribute('data-id', '');

  let prListItems = document.createElement('ul');
  prListItems.setAttribute('class', 'prList');

  if (lastRepo) {
    let firstChild = lastRepo.firstElementChild;
    article.style.cssText = lastRepo.getAttribute('style');
    repositoryInner.style.cssText = firstChild.getAttribute('style');
  }

  repoSection
    .appendChild(article)
    .appendChild(repositoryInner)
    .appendChild(header)
    .appendChild(title)
    .appendChild(document.createTextNode(url));

  header.appendChild(sync);
  repositoryInner.appendChild(prListItems);

  return article;
}

/**
 * Update the repository article element with any changes
 * @param {Object} repository - Repository Details
 * @param {Element} placeholder - Placeholder Element
 */
function updateRepository(repository, placeholder) {
  let {id, name, fullName, placeholderUpdated, prs} = repository;
  let article = document.getElementById(id) || placeholder;

  if (!article) {
    article = drawPlaceholderRepo(repository);
  }

  // If we have not had the opportunity to the DOM earlier, do it now.
  if (!placeholderUpdated) {
    // If there wasn't an id before, set it now
    if (!article.id) {
      article.setAttribute('id', id);
    }

    let sync = article.querySelector('.octicon-sync');
    sync.setAttribute('data-id', id);

    // Swap out the title with a better one
    let repoTitle = article.querySelector('.repo-title');
    repoTitle.innerText = name;
    repoTitle.setAttribute('title', fullName);

    repository.placeholderUpdated = true;
  }

  let prListItems = article.querySelector('.prList');
  let pullRequestFragment = document.createDocumentFragment();

  if (prs.length > prResizeThreshold) {
    prListItems.classList.add('lotsOfPRs');
  } else {
    prListItems.classList.remove('lotsOfPRs');
  }

  prs.forEach(({id, title, url}) => {
    let prListItem = document.createElement('li');
    let prLink = document.createElement('a');
    let prMoreInfo = document.createElement('span');

    prListItem.setAttribute('id', id);

    prLink.setAttribute('href', url);
    prLink.setAttribute('target', '_blank');
    prLink.setAttribute('class', 'prLink octicon octicon-git-pull-request');

    prListItem.classList.add('prListItem');
    prMoreInfo.classList.add('prMoreInfo');

    pullRequestFragment
      .appendChild(prListItem)
      .appendChild(prLink)
      .appendChild(prMoreInfo)
      .appendChild(document.createTextNode(title));
  });

  prListItems.innerHTML = '';
  prListItems.appendChild(pullRequestFragment);

  article.classList.remove('loading');
}

/**
 * Update the rotation of the different repo bubbles
 */
function updateRotations() {
  let count = repoSection.childElementCount;
  let rotation = 360 / count;
  let current = 0;

  let child = repoSection.firstElementChild;
  while (child) {
    let rotateBy = current * rotation;
    let transform = `rotate(${rotateBy}deg) translateY(-${centerDistance}px)`;
    let innerTransform = `transform: rotate(-${rotateBy}deg);`;

    child.style.cssText = `transform: ${transform};`;
    child.firstElementChild.style.cssText = innerTransform;
    current++;
    child = child.nextElementSibling;
  }
}

/**
 * Notify the user something happened
 * @param {String} notifyText - Text we want displayed
 */
function notify(notifyText) {
  let notification = document.createElement('div');
  notification.setAttribute('class', 'notification');

  notifications
    .appendChild(notification)
    .appendChild(document.createTextNode(notifyText));

  setTimeout(function() {
    notification.classList.add('fadeOut');
    setTimeout(function() {
      notifications.removeChild(notification);
    }, 500);
  }, 1000);
}
