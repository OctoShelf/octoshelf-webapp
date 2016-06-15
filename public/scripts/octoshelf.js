'use strict';

import {notify} from './utiltities';
import {loadActionPanelListeners, updateShareLink} from './actionPanel';
import {loadAnimations, updateRotations} from './animations';

import {workerPostMessage, registerWorkerEventHandles} from './conductor';
const postMessageToWorker = workerPostMessage('OctoShelf');

const appElement = document.getElementById('octoshelf');
const repoSection = document.getElementById('repoSection');
const authStatus = document.getElementById('authStatus');
const syncAll = document.getElementById('syncAll');
const addRepoForm = document.getElementById('addRepoForm');
const addRepoInput = document.getElementById('addRepoInput');

const prResizeThreshold = 8;
let isPageVisible = true;
let newPRQueue = [];

let accessToken = '';
let apiUrl = 'https://api.github.com';
let githubUrl = 'https://github.com/';
let origin = 'http://www.octoshelf.com';
let sharedReposString = '';
let sharedRepos = [];

/**
 * RepoStateManager - Abstracts away persisting repository urls and CRUDs.
 * Should we decide to change to a cookie, session storage, etc, we can
 * simply update it here, and not have to worry about a stray localStorage
 * elsewhere.
 */
const repoStateManager = {
  // An array of repository urls
  repositories: [],
  // A set of unique repository urls, used to prevent duplicates being added
  uniqueRepos: new Set(),
  add(url) {
    if (!this.uniqueRepos.has(url)) {
      this.repositories.push(url);
      localStorage.setItem('repositories', JSON.stringify(this.repositories));
    }
  },
  remove(url) {
    this.repositories = this.repositories.filter(repoUrl => repoUrl !== url);
    this.uniqueRepos.delete(url);
    localStorage.setItem('repositories', JSON.stringify(this.repositories));
  },
  fetch() {
    let repoString = localStorage.getItem('repositories') || '[]';
    this.repositories = JSON.parse(repoString);
    this.repositories.forEach(url => {
      this.uniqueRepos.add(url);
      addRepository(url);
    });
  }
};

/**
 * Load Event Listeners specific to OctoShelf
 */
function loadAppEventListeners() {
  addRepoForm.addEventListener('submit', function(event) {
    event.preventDefault();
    addRepository(addRepoInput.value);
    addRepoInput.value = '';
  });
  addRepoInput.addEventListener('input', function() {
    if (addRepoInput.value.includes(githubUrl)) {
      addRepoInput.value = addRepoInput.value.replace(githubUrl, '');
      addRepoInput.value = addRepoInput.value.replace(/\/+$/, '');
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
  repoSection.addEventListener('click', function(event) {
    let {action, url} = event.target && event.target.dataset;
    let actionMap = {
      refresh() {
        postMessageToWorker('getRepoDetailsByUrl', url);
      },
      remove() {
        postMessageToWorker('removeRepo', url);
      }
    };

    if (actionMap[action]) {
      event.preventDefault();
      actionMap[action]();
    }
  });
  window.addEventListener("visibilitychange", function() {
    isPageVisible = document.visibilityState !== 'hidden';
    postMessageToWorker('pageVisibilityChanged', isPageVisible);
    removeNewPullRequestAnimations();
  });
}

/**
 * Toggle the loading class (which drops opacity) on repositories
 * @param {String|Number} id - if of the element we are updating
 * @param {String} url - url of the element we are updating
 * @param {Boolean} isLoading - toggle showing loading state or not
 */
function toggleLoadingRepository([id, url, isLoading]) {
  let article = document.getElementById(id) ||
    document.querySelector(`[data-url="${url}"]`);

  if (!article) {
    notify('Something went wrong');
    return;
  }

  if (isLoading) {
    article.classList.add('loading');
    return;
  }
  article.classList.remove('loading');
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
  article.setAttribute('data-url', url);

  let repositoryInner = document.createElement('div');
  repositoryInner.setAttribute('class', 'repositoryInner');

  let header = document.createElement('header');
  let title = document.createElement('span');
  title.setAttribute('class', 'repo-title');

  let actionsElement = document.createElement('div');
  let repoLink = document.createElement('a');
  let sync = document.createElement('a');
  let trash = document.createElement('a');
  let href = `${githubUrl}${url}`;
  let actions = [
    {elem: repoLink, action: '', className: 'repo', href},
    {elem: sync, action: 'refresh', className: 'sync'},
    {elem: trash, action: 'remove', className: 'x'}
  ];
  actions.forEach(({elem, action, className, href}) => {
    elem.setAttribute('href', href || '#');
    elem.setAttribute('target', 'blank');
    elem.setAttribute('data-action', action);
    elem.setAttribute('class', `octicon octicon-${className} action`);
    elem.setAttribute('data-url', url);
  });

  let prListItems = document.createElement('ul');
  prListItems.setAttribute('class', 'prList');

  if (lastRepo) {
    let firstChild = lastRepo.firstElementChild;
    article.style.cssText = lastRepo.getAttribute('style');
    repositoryInner.style.cssText = firstChild.getAttribute('style');
  }

  article
    .appendChild(repositoryInner)
    .appendChild(header)
    .appendChild(title)
    .appendChild(document.createTextNode(url));

  repositoryInner.appendChild(prListItems);
  actions.forEach(({elem}) => actionsElement.appendChild(elem));
  repositoryInner.appendChild(actionsElement);

  // The Repo is built, lets append it!
  repoSection.appendChild(article);
  repoStateManager.add(url);
  updateShareLink();

  // Now that we've added a placeholder, lets spin to win!
  // The 100ms delay adds a cool animation effect
  setTimeout(updateRotations, 100);

  return article;
}

/**
 * Update the repository article element with any changes
 * @param {Object} repository - Repository Details
 * @param {Element} placeholder - Placeholder Element
 */
function updateRepository(repository) {
  let {id, name, url, fullName, placeholderUpdated, prs} = repository;
  let article = document.getElementById(id) ||
    document.querySelector(`[data-url="${url}"]`);

  if (!article) {
    article = drawPlaceholderRepo(repository);
  }

  // If we have not had the opportunity to the DOM earlier, do it now.
  if (!placeholderUpdated) {
    // If there wasn't an id before, set it now
    if (!article.id) {
      article.setAttribute('id', id);
    }

    let actions = article.querySelectorAll('[data-action]');
    let actionSize = actions.length;
    for (let index = 0; index < actionSize; index++) {
      let action = actions[index];
      action.setAttribute('data-id', id);
    }

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
    let prListItem = document.getElementById(id);
    let prMoreInfo;
    if (prListItem) {
      prMoreInfo = prListItem.querySelector('.prMoreInfo');
      prMoreInfo.innerText = title;
      return pullRequestFragment.appendChild(prListItem);
    }

    prListItem = document.createElement('li');
    let prLink = document.createElement('a');
    prMoreInfo = document.createElement('span');

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
 * Add a repository to the DOM
 * @param {String} url - repo url
 */
function addRepository(url) {
  postMessageToWorker('addRepo', url);
}

/**
 * Remove a repository from the DOM
 * @param {String} url - repositories have a data-url="" to target from
 */
function removeRepository(url) {
  let article = document.querySelector(`[data-url="${url}"]`);
  if (!article) {
    notify('Something went wrong');
    return;
  }
  article.parentNode.removeChild(article);
  repoStateManager.remove(url);
  updateShareLink();

  setTimeout(updateRotations, 100);
}

/**
 * Given an array of pull request ids, add a "newPullRequest" class and remove it
 * @param {Array} ids - array of pull request ids
 */
function animateNewPullRequests(ids) {
  ids.forEach(id => {
    let element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.classList.add('newPullRequest');
  });
  newPRQueue.push(...ids);
  removeNewPullRequestAnimations();
}

/**
 * Remove the "highlight" style from newly added pull requests...
 * only when the user is looking at the page.  Otherwise, we
 * continue queing them up for later.
 */
function removeNewPullRequestAnimations() {
  if (!isPageVisible) {
    return;
  }
  newPRQueue.forEach(id => {
    let element = document.getElementById(id);
    if (!element) {
      return;
    }
    setTimeout(() => {
      element.classList.remove('newPullRequest');
    }, 1000);
  });
  newPRQueue = [];
}

/**
 * Initialize the app with a bunch of variables defining github endpoints
 * @param {Object} apiVariables -  Object that defines several github api values
 */
function initAPIVariables(apiVariables) {
  postMessageToWorker('initAPIVariables', apiVariables);
}

/**
 * If the url has the share queryParam, pass in each of the repos.
 * Example url: /?share=org/repo1,org/repo2,org/repo3
 */
function loadSharedRepos() {
  sharedRepos.filter(repo => repo).forEach(url => {
    addRepository(url);
  });
}

/**
 * OctoShelf, a Multi-Repo PR Manager
 *
 * @param {Object} options - OctoShelf options
 *
 * If you call OctoShelf without any options defined, the app will still work,
 * it will simply use public github api urls as its defaults.
 */
export default function OctoShelf(options) {
  accessToken = options.accessToken || accessToken;
  apiUrl = options.apiUrl || apiUrl;
  githubUrl = options.githubUrl || githubUrl;
  origin = options.origin || origin;
  sharedReposString = options.sharedRepos || sharedReposString;
  sharedRepos = sharedReposString.split(',');

  /**
   * Initialize the app!
   */
  initAPIVariables({accessToken, apiUrl, githubUrl});

  repoStateManager.fetch();
  loadSharedRepos();

  loadAnimations(appElement);
  loadActionPanelListeners(appElement);
  loadAppEventListeners();
}

registerWorkerEventHandles('OctoShelf', {
  drawPlaceholderRepo,
  animateNewPullRequests,
  updateRepository,
  removeRepository,
  toggleLoadingRepository
});
