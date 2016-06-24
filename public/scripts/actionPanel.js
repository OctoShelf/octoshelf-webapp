/**
 * Action Panel is in charge of handling the event listeners and functions
 * pertaining to the ActionPanel (found on the button of the page).
 *
 * ActionPanel actions include
 *  changing refresh options
 *  requesting notification permissions
 *  changing page layout
 *  toggling sharing the current repos
 */

import {workerPostMessage, registerWorkerEventHandles} from './conductor';
const postMessageToWorker = workerPostMessage('ActionPanel');

const appElement = document.getElementById('octoshelf');
const requestNotifications = document.getElementById('requestNotifications');
const refreshRateToggle = document.getElementById('refreshRateToggle');
const refreshContent = document.getElementById('refreshContent');
const refreshRateOptions = document.getElementById('refreshRateOptions');
const shareContent = document.getElementById('shareContent');
const shareToggle = document.getElementById('shareToggle');
const toggleViewType = document.getElementById('toggleViewType');
const moreInfoToggle = document.getElementById('moreInfoToggle');

const topPanelHeight = 60;
const startingRefreshRate = 60000;

/**
 * Request Notification Privileges from the end user
 */
function requestNotificationPermission() {
  Notification.requestPermission();
}

/**
 * Load the App event listeners
 * @return {Object} elements we binded listeners to. (helpful for testing)
 */
export function loadActionPanelListeners() {
  refreshRateOptions.addEventListener('change', function(event) {
    let {value} = event.target;
    let delay = Number(value);
    if (delay) {
      refreshRateToggle.classList.add('active');
      return postMessageToWorker('startRefreshing', delay);
    }
    refreshRateToggle.classList.remove('active');
    return postMessageToWorker('stopRefreshing', '');
  });
  requestNotifications.addEventListener('click', function(event) {
    event.preventDefault();
    requestNotificationPermission();
  });
  if (moreInfoToggle) {
    moreInfoToggle.addEventListener('click', function(event) {
      event.preventDefault();
      let height = window.innerHeight - window.scrollY - topPanelHeight;
      for (let i = 0; i < height; i++) {
        setTimeout(() => {
          window.scrollBy(0, 1);
        }, i);
      }
    });
  }
  toggleViewType.addEventListener('click', function(event) {
    event.preventDefault();
    appElement.classList.toggle('octoInline');
  });
  refreshRateToggle.addEventListener('click', function(event) {
    event.preventDefault();
    shareToggle.classList.remove('active');
    shareContent.classList.remove('toggle');
    refreshContent.classList.toggle('toggle');
  });
  shareToggle.addEventListener('click', function(event) {
    event.preventDefault();
    updateShareLink();
    refreshContent.classList.remove('toggle');
    shareContent.classList.toggle('toggle');
    shareToggle.classList.toggle('active');
  });

  postMessageToWorker('startRefreshing', startingRefreshRate);
  refreshRateToggle.classList.add('active');

  if (Notification && Notification.permission === 'granted') {
    requestNotifications.classList.add('active');
  }

  return {
    appElement,
    refreshRateOptions,
    requestNotifications,
    moreInfoToggle,
    toggleViewType,
    refreshRateToggle,
    shareToggle,
    shareContent,
    refreshContent
  };
}

/**
 * Subtle UI indication that a refresh has happened
 */
export function hasRefreshed() {
  const refreshRateToggle = document.getElementById('refreshRateToggle');
  refreshRateToggle.classList.add('hasRefreshed');
  setTimeout(() => {
    refreshRateToggle.classList.remove('hasRefreshed');
  }, 500);
}

/**
 * Update the sharable link (on add/remove of repos, as well as on toggle)
 * @param {String} origin - root url (precedes the repos query params)
 */
export function updateShareLink(origin = window.location.origin) {
  let repoSection = document.getElementById('repoSection');
  let shareUrl = document.getElementById('shareUrl');

  let child = repoSection.firstChild;
  let urls = [];
  while (child) {
    urls.push(child.getAttribute('data-url'));
    child = child.nextSibling;
  }
  let url = origin;
  if (urls.length) {
    url += '?share=' + urls.join(',');
  }
  shareUrl.value = url;
}

registerWorkerEventHandles('ActionPanel', {hasRefreshed});
