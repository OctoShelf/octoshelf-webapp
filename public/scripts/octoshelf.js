'use strict';

import {log, notify} from './utiltities';
import {loadActionPanelListeners, hasRefreshed, updateShareLink} from './actionPanel';
import {loadAnimations, updateRotations} from './animations';

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "OctoShelf" }] */
/**
 * OctoShelf, a Multi-Repo PR Manager
 *
 * If you call OctoShelf without any of these defined, the app will still work.
 * But, without an access_token you will be limited to 60 calls per hour, and
 * if you are intending to access an enterprise github's api, you will need to
 * use a public access token generated from your corp's settings.
 *
 * @param {Element} appElement - Elemnt that OctoShelf renders onto
 * @param {Object} options - OctoShelf options
 * @param {Worker} appWorker - OctoShelf's Web Worker, in charge of fetching from Github's API
 */
export default function OctoShelf(appElement, options, appWorker) {
  const initAccessToken = options.initAccessToken;
  const initApiUrl = options.initApiUrl || 'https://api.github.com';
  const initGithubUrl = options.initGithubUrl || 'https://github.com/';
  const origin = options.origin || 'http://www.octoshelf.com';
  const sharedReposString = options.sharedRepos || '';
  const sharedRepos = sharedReposString.split(',');

  const repoSection = document.getElementById('repoSection');
  const authStatus = document.getElementById('authStatus');
  const syncAll = document.getElementById('syncAll');
  const addRepoForm = document.getElementById('addRepoForm');
  const addRepoInput = document.getElementById('addRepoInput');

  const prResizeThreshold = 8;
  let isPageVisible = true;
  let newPRQueue = [];

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
      if (addRepoInput.value.includes(initGithubUrl)) {
        addRepoInput.value = addRepoInput.value.replace(initGithubUrl, '');
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
          parsedPostMessage('setAccessToken', token);
          authStatus.parentNode.removeChild(authStatus);
          clearTimeout(timeout);
          event.source.close();
        });
      });
    }
    syncAll.addEventListener('click', function(event) {
      event.preventDefault();
      parsedPostMessage('getAllRepoDetails');
    });
    repoSection.addEventListener('click', function(event) {
      let {action, url} = event.target && event.target.dataset;
      let actionMap = {
        refresh() {
          parsedPostMessage('getRepoDetailsByUrl', url);
        },
        remove() {
          parsedPostMessage('removeRepo', url);
        }
      };

      if (actionMap[action]) {
        event.preventDefault();
        actionMap[action]();
      }
    });
    window.addEventListener("visibilitychange", function() {
      isPageVisible = document.visibilityState !== 'hidden';
      parsedPostMessage('pageVisibilityChanged', isPageVisible);
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
    let href = `${initGithubUrl}${url}`;
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
    parsedPostMessage('addRepo', url);
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
   * Unwrap PostMessages
   * @param {Function} fn - function to call
   * @param {Function} msgType - function name
   * @param {String} params - Stringified object that contains a postData prop
   */
  function unwrapPostMessage(fn, msgType, params) {
    let parsedParams = JSON.parse(params);
    let postData = parsedParams.postData;
    if (msgType !== 'log') {
      log(`[OctoShelf] "${msgType}" called with:`, postData);
    }
    fn(postData);
  }

  /**
   * Send a Parsed Post Message
   * @param {String} messageType - function we will attempt to call
   * @param {*} postData - Some data that we will wrap into a stringified object
   */
  function parsedPostMessage(messageType, postData) {
    appWorker.postMessage([messageType, JSON.stringify({postData})]);
  }

  /**
   * Contract: appWorker.postMessage([msgType, msgData]);
   * @type {Worker}
   */
  appWorker.addEventListener('message', function({data: [msgType, msgData]}) {
    let msgTypes = {
      log,
      notify,
      hasRefreshed,
      drawPlaceholderRepo,
      animateNewPullRequests,
      updateRepository,
      removeRepository,
      toggleLoadingRepository
    };

    if (msgTypes[msgType]) {
      return unwrapPostMessage(msgTypes[msgType], msgType, msgData);
    }
    log(`"${msgType}" was not part of the allowed postMessage functions`);
  });

  /**
   * Initialize the app with a bunch of variables defining github endpoints
   * @param {Object} apiVariables Object that defines several github api values
   */
  function initAPIVariables(apiVariables) {
    parsedPostMessage('initAPIVariables', apiVariables);
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
   * Initialize the app!
   */
  (function init() {
    if (!initApiUrl || !initGithubUrl) {
      let initVars = {initApiUrl, initGithubUrl};
      let missing = Object.keys(initVars)
        .filter(initVar => !initVars[initVar])
        .join(', ');
      return notify(`Several api vars were found missing: ${missing}`, 4000);
    }
    initAPIVariables({initAccessToken, initApiUrl, initGithubUrl});

    repoStateManager.fetch();
    loadSharedRepos();

    loadAnimations(appElement);
    loadActionPanelListeners(appElement, parsedPostMessage);
    loadAppEventListeners();
  })();
}
