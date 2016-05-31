
let appWorker = new Worker('./scripts/octo.worker.js');

let repoSection = document.getElementById('repoSection');
let authStatus = document.getElementById('authStatus');
let syncAll = document.getElementById('syncAll');
let addRepoForm = document.getElementById('addRepoForm');
let addRepoInput = document.getElementById('addRepoInput');
let notifications = document.getElementById('notifications');

let authToken = document.getElementById('github_authToken').value;
// let oathUrl = document.getElementById('github_oathUrl').value;
// let clientId = document.getElementById('github_clientId').value;

const stylesheetHelper = document.createElement("style");
const bubbleSize = 150;
const centerDistance = 250;
const prResizeThreshold = 8;

/**
 * Load the App event listeners
 */
function loadEventListeners() {
  let resizeDebounce;
  addRepoForm.addEventListener('submit', function(event) {
    event.preventDefault();
    parsedPostMessage('addRepo', addRepoInput.value);
    addRepoInput.value = '';
  });
  syncAll.addEventListener('click', function(event) {
    event.preventDefault();
    parsedPostMessage('getAllRepoDetails');
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
    let actionMap = {
      refresh: () => {
        event.preventDefault();
        parsedPostMessage('getRepoDetailsById', id);
      }
    };

    if (actionMap[action]) {
      actionMap[action]();
    }
  });
}

/**
 * Update the access token (and UI)
 * @param {String} newAccessToken - new access token
 */
function updateAccessToken(newAccessToken) {
  if (!newAccessToken) {
    return;
  }
  parsedPostMessage('setAccessToken', newAccessToken);
  authStatus.classList.remove('octicon-issue-reopened');
  authStatus.classList.add('octicon-issue-closed');
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
  let cssRule = `top:${top}px;left:${left}px;height:${size}px;width:${size}px`;
  let afterRule = `top: ${size - 1}px;`;
  stylesheetHelper.sheet.insertRule(`.bubble {${cssRule}}`, 0);
  stylesheetHelper.sheet.insertRule(`.repository:after {${afterRule}}`, 0);
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

  let sync = document.createElement('a');
  sync.setAttribute('href', '#');
  sync.setAttribute('class', 'octicon octicon-sync sync');
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
    log(`"${msgType}" called with:`, postData);
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
 * Contract: appWorker.postMessage([msgType, msgData]);
 * @type {Worker}
 */
appWorker.addEventListener('message', function({data: [msgType, msgData]}) {
  let msgTypes = {
    log,
    notify,
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
 * Initialize the app!
 */
(function init(innerHeight, innerWidth) {
  document.head.appendChild(stylesheetHelper);
  updateBubbleStyles(innerHeight, innerWidth);
  updateAccessToken(authToken.value);
  loadEventListeners();
})(window.innerHeight, window.innerWidth);
