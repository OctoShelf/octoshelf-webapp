
import {notify} from './utilities';
import {addLocalRepo, removeLocalRepo} from './localRepoState';
import {updateShareLink} from './actionPanel';
import {updateRotations} from './animations';
import {workerPostMessage, registerWorkerEventHandles} from './conductor';
const postMessageToWorker = workerPostMessage('RepoSection');

const repoSection = document.getElementById('repoSection');

const prResizeThreshold = 8;
let newPRQueue = [];
let isPageVisible = true;
let githubUrl = '';

/**
 * Load Event Listeners specific to OctoShelf
 * @param {Object} apiOptions - api options
 */
export function loadRepoSection(apiOptions) {
  githubUrl = apiOptions.githubUrl;
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
export function toggleLoadingRepository([url, isLoading]) {
  let article = document.querySelector(`[data-url="${url}"]`);

  if (!article) {
    notify(`${url} doesn't exist on the page`);
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
export function drawPlaceholderRepo({url}) {
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
  addLocalRepo(url);
  updateShareLink();

  // Now that we've added a placeholder, lets spin to win!
  // The 100ms delay adds a cool animation effect
  setTimeout(updateRotations, 100);

  return article;
}

/**
 * Remove a repository from the DOM
 * @param {String} url - repositories have a data-url="" to target from
 */
export function removeRepository(url) {
  let article = document.querySelector(`[data-url="${url}"]`);
  if (!article) {
    notify(`${url} doesn't exist on the page`);
    return;
  }
  article.parentNode.removeChild(article);
  removeLocalRepo(url);
  updateShareLink();

  setTimeout(updateRotations, 100);
}

/**
 * Update the repository article element with any changes
 * @param {Object} repository - Repository Details
 * @param {Element} placeholder - Placeholder Element
 */
export function updateRepository(repository) {
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
 * Remove the "highlight" style from newly added pull requests...
 * only when the user is looking at the page.  Otherwise, we
 * continue queing them up for later.
 */
export function removeNewPullRequestAnimations() {
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
 * Given an array of pull request ids, add a "newPullRequest" class and remove it
 * @param {Array} ids - array of pull request ids
 */
export function animateNewPullRequests(ids) {
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

registerWorkerEventHandles('RepoSection', {
  drawPlaceholderRepo,
  animateNewPullRequests,
  updateRepository,
  removeRepository,
  toggleLoadingRepository
});
