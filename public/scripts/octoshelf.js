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
 * @param {Object} options - OctoShelf options
 */
function OctoShelf(options) {
  var initAccessToken = options.initAccessToken;
  var initApiUrl = options.initApiUrl || 'https://api.github.com';
  var initGithubUrl = options.initGithubUrl || 'https://github.com/';
  var origin = options.origin || 'http://www.octoshelf.com';
  var sharedReposString = options.sharedRepos || '';
  var sharedRepos = sharedReposString.split(',');

  var appWorker = new Worker('./scripts/octo.worker.js');
  var app = document.getElementById('octoshelf');
  var repoSection = document.getElementById('repoSection');
  var authStatus = document.getElementById('authStatus');
  var syncAll = document.getElementById('syncAll');
  var addRepoForm = document.getElementById('addRepoForm');
  var addRepoInput = document.getElementById('addRepoInput');
  var notifications = document.getElementById('notifications');
  var refreshRateIcon = document.getElementById('refreshRateIcon');
  var refreshRateOptions = document.getElementById('refreshRateOptions');
  var requestNotifications = document.getElementById('requestNotifications');
  var appBackground = document.getElementById('appBackground');

  var toggleViewType = document.getElementById('toggleViewType');
  var moreInfoToggle = document.getElementById('moreInfoToggle');

  var shareWrapper = document.getElementById('shareWrapper');
  var shareContent = document.getElementById('shareContent');
  var shareToggle = document.getElementById('shareToggle');

  var stylesheetHelper = document.createElement("style");
  var topPanelHeight = 60;
  var inputWrapperSize = 130;
  var startingRefreshRate = 60000;
  var bubbleSize = 150;
  var prResizeThreshold = 8;
  var isPageVisible = true;
  var newPRQueue = [];
  var centerDistance = 0;

  /**
   * RepoStateManager - Abstracts away persisting repository urls and CRUDs.
   * Should we decide to change to a cookie, session storage, etc, we can
   * simply update it here, and not have to worry about a stray localStorage
   * elsewhere.
   */
  var repoStateManager = {
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
      this.repositories = this.repositories.filter(function(repoUrl) {
        return repoUrl !== url;
      });
      this.uniqueRepos.delete(url);
      localStorage.setItem('repositories', JSON.stringify(this.repositories));
    },
    fetch() {
      var repoString = localStorage.getItem('repositories') || '[]';
      var uniqueRepos = this.uniqueRepos;
      this.repositories = JSON.parse(repoString);
      this.repositories.forEach(function(url) {
        uniqueRepos.add(url);
        addRepository(url);
      });
    }
  };

  /**
   * Load the App event listeners
   */
  function loadEventListeners() {
    var resizeDebounce;
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
        var {href} = event.target;
        var authWindow = window.open(href, '', '');
        var timeout = setInterval(function() {
          authWindow.postMessage('fetchToken', origin);
        }, 500);

        window.addEventListener('message', function(event) {
          if (event.origin !== origin) {
            return;
          }

          var token = event.data;
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
      var {action, url} = event.target && event.target.dataset;
      var actionMap = {
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
      var {value} = event.target;
      var delay = Number(value);
      if (delay) {
        return startRefreshing(delay);
      }
      return stopRefreshing();
    });
    requestNotifications.addEventListener('click', function(event) {
      event.preventDefault();
      requestNotifcations();
    });
    moreInfoToggle.addEventListener('click', function(event) {
      event.preventDefault();
      var height = window.innerHeight - window.scrollY - topPanelHeight;
      for (var i = 0; i < height; i++) {
        setTimeout(function() {
          window.scrollBy(0, 1);
        }, i);
      }
    });
    toggleViewType.addEventListener('click', function(event) {
      event.preventDefault();
      app.classList.toggle('octoInline');
    });
    shareToggle.addEventListener('click', function(event) {
      event.preventDefault();
      var child = repoSection.firstChild;
      var urls = [];
      while (child) {
        urls.push(child.dataset.url);
        child = child.nextSibling;
      }
      var url = window.location.origin + '?share=' + urls.join(',');
      shareWrapper.classList.toggle('toggle');
      shareContent.innerText = url;
    });

    window.addEventListener('resize', function() {
      if (resizeDebounce) {
        clearTimeout(resizeDebounce);
      }

      resizeDebounce = setTimeout(function(innerHeight, innerWidth) {
        updateBubbleStyles(innerHeight, innerWidth);
      }, 30, window.innerHeight, window.innerWidth);
    });
    window.addEventListener("visibilitychange", function() {
      isPageVisible = document.visibilityState !== 'hidden';
      parsedPostMessage('pageVisibilityChanged', isPageVisible);
      removeNewPullRequestAnimations();
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
    var modifiedHeight = innerHeight - 40;
    var bubbleModify = bubbleSize / 2;
    var top = (innerHeight / 2) - bubbleModify - 40;
    var left = (innerWidth / 2) - bubbleModify;

    var hDistance = (modifiedHeight / 2) - (bubbleSize * 2 / 3);
    var wDistance = (innerWidth / 2) - (bubbleSize * 2 / 3);
    centerDistance = hDistance < wDistance ? hDistance : wDistance;

    while (stylesheetHelper.sheet.cssRules.length) {
      if (stylesheetHelper.sheet.removeRule) {
        stylesheetHelper.sheet.removeRule(0);
      } else if (stylesheetHelper.sheet.deleteRule) {
        stylesheetHelper.sheet.deleteRule(0);
      }
    }
    var size = bubbleSize;
    var dims = ['height', 'width'].map(function(prop) {
      return prop + `:${size}px`;
    }).join(';');
    var pos = `top:${top}px;left:${left}px;`;
    var wrapSelector = '.app-prompt, .app-repositoriesWrapper';
    var wrapRule = `transition: all .5s ease;${pos};${dims}`;

    var afterHeight = centerDistance - (bubbleSize / 2);
    var afterRule = `top: ${size}px;height:${afterHeight}px`;

    stylesheetHelper.sheet.insertRule(`${wrapSelector} {${wrapRule}}`, 0);
    stylesheetHelper.sheet.insertRule(`.bubble {${dims}}`, 0);
    stylesheetHelper.sheet.insertRule(`.repository:after {${afterRule}}`, 0);

    var toggleInline = innerHeight < 550 || innerWidth < 500;
    app.classList.toggle('octoInline', toggleInline);

    updateRotations();
  }

  /**
   * Github's Prefix is dynamic. To account for corp github urls,
   * when the page loads we auto resize the font-size to make sure it fits
   */
  function resizeGitubPrefix() {
    var prefix = document.querySelector('.addRepoInput-prefix');
    var prefixWidth = prefix.scrollWidth;
    var sizeRatio = ~~((inputWrapperSize / (prefixWidth + 10)) * 100) / 100;
    var fontSize = sizeRatio < 1 ? sizeRatio : 1;
    prefix.style.fontSize = `${fontSize}rem`;
  }

  /**
   * Toggle the loading class (which drops opacity) on repositories
   * @param {String|Number} id - if of the element we are updating
   * @param {String} url - url of the element we are updating
   * @param {Boolean} isLoading - toggle showing loading state or not
   */
  function toggleLoadingRepository([id, url, isLoading]) {
    var article = document.getElementById(id) ||
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
    var lastRepo = repoSection.lastElementChild;

    var article = document.createElement('article');
    article.setAttribute('class', 'bubble repository loading');
    article.setAttribute('data-url', url);

    var repositoryInner = document.createElement('div');
    repositoryInner.setAttribute('class', 'repositoryInner');

    var header = document.createElement('header');
    var title = document.createElement('span');
    title.setAttribute('class', 'repo-title');

    var actionsElement = document.createElement('div');
    var repoLink = document.createElement('a');
    var sync = document.createElement('a');
    var trash = document.createElement('a');
    var href = `${initGithubUrl}${url}`;
    var actions = [
      {elem: repoLink, action: '', className: 'repo', href},
      {elem: sync, action: 'refresh', className: 'sync'},
      {elem: trash, action: 'remove', className: 'x'}
    ];
    actions.forEach(function({elem, action, className, href}) {
      elem.setAttribute('href', href || '#');
      elem.setAttribute('target', 'blank');
      elem.setAttribute('data-action', action);
      elem.setAttribute('class', `octicon octicon-${className} action`);
      elem.setAttribute('data-url', url);
    });

    var prListItems = document.createElement('ul');
    prListItems.setAttribute('class', 'prList');

    if (lastRepo) {
      var firstChild = lastRepo.firstElementChild;
      article.style.cssText = lastRepo.getAttribute('style');
      repositoryInner.style.cssText = firstChild.getAttribute('style');
    }

    article
      .appendChild(repositoryInner)
      .appendChild(header)
      .appendChild(title)
      .appendChild(document.createTextNode(url));

    repositoryInner.appendChild(prListItems);
    actions.forEach(function({elem}) {
      actionsElement.appendChild(elem);
    });
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
    var {id, name, url, fullName, placeholderUpdated, prs} = repository;
    var article = document.getElementById(id) ||
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

      var actions = article.querySelectorAll('[data-action]');
      var actionSize = actions.length;
      for (var index = 0; index < actionSize; index++) {
        var action = actions[index];
        action.setAttribute('data-id', id);
      }

      // Swap out the title with a better one
      var repoTitle = article.querySelector('.repo-title');
      repoTitle.innerText = name;
      repoTitle.setAttribute('title', fullName);

      repository.placeholderUpdated = true;
    }

    var prListItems = article.querySelector('.prList');
    var pullRequestFragment = document.createDocumentFragment();

    if (prs.length > prResizeThreshold) {
      prListItems.classList.add('lotsOfPRs');
    } else {
      prListItems.classList.remove('lotsOfPRs');
    }

    prs.forEach(function({id, title, url}) {
      var prListItem = document.getElementById(id);
      var prMoreInfo;
      if (prListItem) {
        prMoreInfo = prListItem.querySelector('.prMoreInfo');
        prMoreInfo.innerText = title;
        return pullRequestFragment.appendChild(prListItem);
      }

      prListItem = document.createElement('li');
      var prLink = document.createElement('a');
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
    var article = document.querySelector(`[data-url="${url}"]`);
    if (!article) {
      notify('Something went wrong');
      return;
    }
    article.parentNode.removeChild(article);
    repoStateManager.remove(url);

    setTimeout(updateRotations, 100);
  }

  /**
   * Given an array of pull request ids, add a "newPullRequest" class and remove it
   * @param {Array} ids - array of pull request ids
   */
  function animateNewPullRequests(ids) {
    ids.forEach(function(id) {
      var element = document.getElementById(id);
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
    newPRQueue.forEach(function(id) {
      var element = document.getElementById(id);
      if (!element) {
        return;
      }
      setTimeout(function() {
        element.classList.remove('newPullRequest');
      }, 1000);
    });
    newPRQueue = [];
  }

  /**
   * Update the rotation of the different repo bubbles
   */
  function updateRotations() {
    var count = repoSection.childElementCount;
    var rotation = 360 / count;
    var current = 0;

    var child = repoSection.firstElementChild;
    while (child) {
      var rotateBy = current * rotation;
      var transform = `rotate(${rotateBy}deg) translateY(-${centerDistance}px)`;
      var innerTransform = `transform: rotate(-${rotateBy}deg);`;

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
  function notify(notifyText, duration) {
    if (duration) {
      duration = 1000;
    }
    var notification = document.createElement('div');
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
    var parsedParams = JSON.parse(params);
    var postData = parsedParams.postData;
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
    var args = Array.from(arguments);
    var message = args[0];
    var otherMessages = args.slice(1);
    if (message instanceof Array) {
      otherMessages.push(message[1]);
      message = message[0];
    }

    if (console && console.log) {
      if (console.group && otherMessages.length) {
        console.group(message);
        otherMessages.forEach(function(msg) {
          console.log(msg);
        });
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
  function startRefreshing(delay) {
    if (!delay) {
      delay = 1000;
    }
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
    setTimeout(function() {
      refreshRateIcon.style.cssText = '';
    }, 500);
  }

  /**
   * Contract: appWorker.postMessage([msgType, msgData]);
   * @type {Worker}
   */
  appWorker.addEventListener('message', function({data: [msgType, msgData]}) {
    var msgTypes = {
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
   * Lazy Load a sweet background image into focus.
   *
   * We start off with a low-res blurred image on the `body` tag that gets loaded
   * very quickly. We then load a high-res background image to an empty `img` tag.
   * Once the image has finished loading, we insert the image as a background to
   * an empty div that has blur(10px), and slowly animate away that blur to 0.
   */
  function lazyLoadBackground() {
    var img = document.createElement('img');
    var imgSrc = '/images/background.jpg';
    var now = Date.now();
    img.setAttribute('src', imgSrc);

    img.onload = function() {
      appBackground.style.backgroundImage = `url(${imgSrc})`;
      var loadTime = Date.now() - now;

      /**
       * If the loadTime is less than 100ms, the background was likely cached.
       * Slowly unbluring the background is a cool nice animation, but if they've
       * seen it once before, we should limit the duration of the blurry state.
       */
      if (loadTime < 1000) {
        return appBackground.classList.add('loaded');
      }

      setTimeout(function() {
        appBackground.classList.add('loaded');
      }, 1000);
    };
  }

  /**
   * If the url has the share queryParam, pass in each of the repos.
   * Example url: /?share=org/repo1,org/repo2,org/repo3
   */
  function loadSharedRepos() {
    sharedRepos.filter(function(repo) {
      return repo;
    }).forEach(function(url) {
      addRepository(url);
    });
  }

  /**
   * Initialize the app!
   */
  (function init() {
    if (!initApiUrl || !initGithubUrl) {
      var initVars = {initApiUrl, initGithubUrl};
      var missing = Object.keys(initVars)
        .filter(function(initVar) {
          return !initVars[initVar];
        })
        .join(', ');
      return notify(`Several api vars were found missing: ${missing}`, 4000);
    }
    document.head.appendChild(stylesheetHelper);
    lazyLoadBackground();
    initAPIVariables({initAccessToken, initApiUrl, initGithubUrl});
    updateBubbleStyles(window.innerHeight, window.innerWidth);
    resizeGitubPrefix();
    repoStateManager.fetch();
    loadSharedRepos();
    startRefreshing(startingRefreshRate);
    loadEventListeners();
  })();
}
