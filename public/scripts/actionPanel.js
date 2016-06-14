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

const repoSection = document.getElementById('repoSection');
const requestNotifications = document.getElementById('requestNotifications');
const refreshRateToggle = document.getElementById('refreshRateToggle');
const refreshContent = document.getElementById('refreshContent');
const refreshRateOptions = document.getElementById('refreshRateOptions');
const shareContent = document.getElementById('shareContent');
const shareUrl = document.getElementById('shareUrl');
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
 * @param {Element} appElement - The main OctoShelf element
 * @param {Function} parsedPostMessage - helper postMessage-to-worker function
 */
export function loadActionPanelListeners(appElement, parsedPostMessage) {
  refreshRateOptions.addEventListener('change', function(event) {
    let {value} = event.target;
    let delay = Number(value);
    if (delay) {
      return parsedPostMessage('startRefreshing', delay);
    }
    return parsedPostMessage('stopRefreshing', '');
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
    shareContent.classList.remove('toggle');
    refreshContent.classList.toggle('toggle');
  });
  shareToggle.addEventListener('click', function(event) {
    event.preventDefault();
    updateShareLink();
    refreshContent.classList.remove('toggle');
    shareContent.classList.toggle('toggle');
  });

  parsedPostMessage('startRefreshing', startingRefreshRate);
}

/**
 * Subtle UI indication that a refresh has happened
 */
export function hasRefreshed() {
  refreshRateToggle.classList.add('hasRefreshed');
  setTimeout(() => {
    refreshRateToggle.classList.remove('hasRefreshed');
  }, 500);
}

/**
 * Update the sharable link (on add/remove of repos, as well as on toggle)
 */
export function updateShareLink() {
  let child = repoSection.firstChild;
  let urls = [];
  while (child) {
    urls.push(child.dataset.url);
    child = child.nextSibling;
  }
  let url = window.location.origin;
  if (urls.length) {
    url += '?share=' + urls.join(',');
  }
  shareUrl.value = url;
}
