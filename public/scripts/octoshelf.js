'use strict';

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "OctoShelf" }] */
/**
 * OctoShelf, a Multi-Repo PR Manager
 *
 * If you call OctoShelf without any of these defined, the app will still work.
 * But, without an access_token you will be limited to 60 calls per hour, and
 * if you are intending to access an enterprise github's api, you will need to
 * use a public access token generated from your corp's settings.
 *
 * @param {String} initAccessToken - github access token, optional but recommended
 * @param {String} initApiUrl - github api url, which differs for corp accounts
 * @param {String} initGithubUrl - github root url
 */
function OctoShelf({initAccessToken, initApiUrl = 'https://api.github.com', initGithubUrl = 'https://github.com/'}) {
  const appWorker = new Worker('./scripts/octo.worker.js');
  const repoSection = document.getElementById('repoSection');
  const syncAll = document.getElementById('syncAll');
  const addRepoForm = document.getElementById('addRepoForm');
  const addRepoInput = document.getElementById('addRepoInput');
  const notifications = document.getElementById('notifications');
  const refreshRateIcon = document.getElementById('refreshRateIcon');
  const refreshRateOptions = document.getElementById('refreshRateOptions');
  const requestNotifications = document.getElementById('requestNotifications');

  const stylesheetHelper = document.createElement("style");
  const inputWrapperSize = 130;
  const startingRefreshRate = 60000;
  const bubbleSize = 150;
  const centerDistance = 300;
  const prResizeThreshold = 8;

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
   * Load the App event listeners
   */
  function loadEventListeners() {
    let resizeDebounce;
    addRepoForm.addEventListener('submit', function(event) {
      event.preventDefault();
      addRepository(addRepoInput.value);
      addRepoInput.value = '';
    });
    addRepoInput.addEventListener('input', function() {
      if (addRepoInput.value.includes(initGithubUrl)) {
        addRepoInput.value = addRepoInput.value.replace(initGithubUrl, '');
      }
    });
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
    refreshRateOptions.addEventListener('change', function(event) {
      let {value} = event.target;
      let delay = Number(value);
      if (delay) {
        return startRefreshing(delay);
      }
      return stopRefreshing();
    });
    requestNotifications.addEventListener('click', function(event) {
      event.preventDefault();
      requestNotifcations();
    });

    window.addEventListener('resize', function() {
      if (resizeDebounce) {
        clearTimeout(resizeDebounce);
      }

      resizeDebounce = setTimeout(function(innerHeight, innerWidth) {
        updateBubbleStyles(innerHeight, innerWidth);
      }, 60, window.innerHeight, window.innerWidth);
    });
    window.addEventListener("visibilitychange", function() {
      let isVisible = document.visibilityState !== 'hidden';
      parsedPostMessage('pageVisibilityChanged', isVisible);
    });
  }

  /**
   * Request Notification Privileges from the end user
   */
  function requestNotifcations() {
    Notification.requestPermission();
  }

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
    let dims = ['height', 'width'].map(prop => prop + `:${size}px`).join(';');
    let pos = `top:${top}px;left:${left}px;`;
    let wrapRule = `transition: all .5s ease;${pos};${dims}`;
    let wrapSelector = '.app-prompt, .app-repositoriesWrapper';
    let afterRule = `top: ${size - 1}px;height:${size}px`;

    stylesheetHelper.sheet.insertRule(`${wrapSelector} {${wrapRule}}`, 0);
    stylesheetHelper.sheet.insertRule(`.bubble {${dims}}`, 0);
    stylesheetHelper.sheet.insertRule(`.repository:after {${afterRule}}`, 0);
  }

  /**
   * Github's Prefix is dynamic. To account for corp github urls,
   * when the page loads we auto resize the font-size to make sure it fits
   */
  function resizeGitubPrefix() {
    let prefix = document.querySelector('.addRepoInput-prefix');
    let prefixWidth = prefix.scrollWidth;
    let sizeRatio = ~~((inputWrapperSize / (prefixWidth + 10)) * 100) / 100;
    let fontSize = sizeRatio < 1 ? sizeRatio : 1;
    prefix.style.fontSize = `${fontSize}rem`;
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
      actions.forEach(action => action.setAttribute('data-id', id));

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

    setTimeout(updateRotations, 100);
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
   * @param {Number} duration - duration that the notification will linger
   */
  function notify(notifyText, duration = 1000) {
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
    }, duration);
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
   * Log a message to console (if console exists)
   * @param {String} message - message to log (or group)
   * @param {String|Object} extraStuff - extra stuff to log inside message group
   */
  function log() {
    let args = Array.from(arguments);
    let message = args[0];
    let otherMessages = args.slice(1);
    if (message instanceof Array) {
      otherMessages.push(message[1]);
      message = message[0];
    }

    if (console && console.log) {
      if (console.group && otherMessages.length) {
        console.group(message);
        otherMessages.forEach(msg => console.log(msg));
        console.groupEnd(message);
        return;
      }
      console.log(message);
    }
  }

  /**
   * Post a message to the WebWorker telling it to start refreshing
   * @param {Number} delay - delay between each refresh
   */
  function startRefreshing(delay = 1000) {
    parsedPostMessage('startRefreshing', delay);
  }

  /**
   * Post a message to the WebWorker telling it to stop refreshing
   */
  function stopRefreshing() {
    parsedPostMessage('stopRefreshing', '');
  }

  /**
   * Subtle UI indication that a refresh has happened
   */
  function hasRefreshed() {
    refreshRateIcon.style.cssText = 'color: #61FF61;transform: scale(4);';
    setTimeout(() => {
      refreshRateIcon.style.cssText = '';
    }, 500);
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
    document.head.appendChild(stylesheetHelper);
    initAPIVariables({initAccessToken, initApiUrl, initGithubUrl});
    updateBubbleStyles(window.innerHeight, window.innerWidth);
    resizeGitubPrefix();
    repoStateManager.fetch();
    startRefreshing(startingRefreshRate);
    loadEventListeners();
  })();
}
