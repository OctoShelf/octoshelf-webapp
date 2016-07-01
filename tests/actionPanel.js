
import test from 'ava';

import {registerWorker} from '../public/scripts/conductor';
import {getWorker} from './helpers/octoTestHelpers';

let hasRefreshed;
let updateShareLink;
let loadActionPanel;

function resetDOMAndActionPanel() {
  let {shh} = require('../public/scripts/utilities');
  shh();
  global.document = require('jsdom').jsdom(`
    <div id="octoshelf"><div id="repoSection"></div></div>
    <span class="infoPanel-actions">
      <a href="#" class="octicon octicon-clock infoPanel-action refreshRate-toggle" id="refreshRateToggle"></a>
      <a href="#" class="octicon octicon-broadcast infoPanel-action notification-button" id="requestNotifications"></a>
      <a href="#" id="toggleViewType" class="octicon octicon-three-bars infoPanel-action toggleViewType"></a>
      <a href="#" id="shareToggle" class="octicon octicon-link infoPanel-action share-toggle"></a>
      <a href="#" id="moreInfoToggle" class="octicon octicon-question infoPanel-action moreInfo-toggle"></a>
      <span class="toggleContentContainer">
          <span id="refreshContent" class="refreshRate_moreInfo">
              <div>Refresh Rate</div>
              <ul class="refreshRate_options" id="refreshRateOptions">
                  <li>
                      <label class="refreshRate_option">
                          <input class="refreshRate_input" type="radio" name="refreshRate" value="0" id="refresh_0" />
                          <span class="refreshRate_inputDisplay">None</span>
                      </label>
                  </li>
                  <li>
                      <label class="refreshRate_option">
                          <input id="refresh_60000" class="refreshRate_input" type="radio" name="refreshRate"  value="60000" checked="checked" />
                          <span class="refreshRate_inputDisplay">1 min</span>
                      </label>
                  </li>
                  <li>
                      <label class="refreshRate_option">
                          <input class="refreshRate_input" type="radio" name="refreshRate" value="300000" />
                          <span class="refreshRate_inputDisplay">5 mins</span>
                      </label>
                  </li>
              </ul>
          </span>
          <span id="shareContent" class="share-content">
              <span>Share These Repos:</span>
              <textarea class="share-urlInput" id="shareUrl" readonly onClick="this.setSelectionRange(0, this.value.length)"></textarea>
          </span>
      </span>
    </span>
   `);
  delete require.cache[require.resolve('../public/scripts/actionPanel')];
  let actionPanel = require('../public/scripts/actionPanel');
  hasRefreshed = actionPanel.hasRefreshed;
  updateShareLink = actionPanel.updateShareLink;
  loadActionPanel = actionPanel.loadActionPanel;
}

test.beforeEach(resetDOMAndActionPanel);

test('startRefreshing called on load', t => {

  let addEventListener = () => {};
  let postMessage = (result) => {
    let [fnName] = result;
    t.is(fnName, 'startRefreshing');
  };
  let worker = getWorker(addEventListener, postMessage);

  registerWorker(worker);
  loadActionPanel();
});

test('toggling refreshRate changes', t => {

  return new Promise(function(resolve) {

    let {refreshRateOptions} = loadActionPanel();

    let addEventListener = () => {};
    let postMessage = (result) => {
      let [fnName] = result;
      t.is(fnName, 'stopRefreshing');
    };

    let worker = getWorker(addEventListener, postMessage);
    registerWorker(worker);

    // Test turning off the refresh rate
    refreshRateOptions.dispatchEvent(new Event('change'));

    postMessage = (result) => {
      let [fnName, postDataString] = result;
      let {postData} = JSON.parse(postDataString);
      t.is(fnName, 'startRefreshing');
      t.is(postData, 6000);
      resolve();
    };

    // Replace the postMessage function. to test different behavior
    worker.postMessage = postMessage;

    // Cheaty hack so that the event.target.value is 6000, :troll:
    refreshRateOptions.value = 6000;

    // Test re-activating the refresh rate
    refreshRateOptions.dispatchEvent(new Event('change'));
  });
});

test('request notification permissions', t => {
  global.Notification = {
    requestPermission() {
      t.pass();
    }
  };
  let addEventListener = () => {};
  let postMessage = () => {};
  let worker = getWorker(addEventListener, postMessage);

  registerWorker(worker);
  let {requestNotifications} = loadActionPanel();
  requestNotifications.click();
});

test('toggle more info', t => {

  return new Promise(function(resolve) {
    let count = 0;
    global.window.scrollBy = () => {
      count++;
    };
    global.window.innerHeight = 70;
    global.window.scrollY = 5;
    let addEventListener = () => {};
    let postMessage = () => {};
    let worker = getWorker(addEventListener, postMessage);

    registerWorker(worker);
    let {moreInfoToggle} = loadActionPanel();
    moreInfoToggle.click();

    setTimeout(() => {
      // innerHeight - scrollY - topPanelHeight
      t.is(count, 5);
      resolve();
    }, 10);

  });
});

test('toggleViewType', t => {
  let addEventListener = () => {};
  let postMessage = () => {};
  let worker = getWorker(addEventListener, postMessage);

  registerWorker(worker);
  let {appElement, toggleViewType} = loadActionPanel();
  t.is(appElement.classList.contains('octoInline'), false);
  toggleViewType.click();
  t.is(appElement.classList.contains('octoInline'), true);
  toggleViewType.click();
  t.is(appElement.classList.contains('octoInline'), false);
});

test('refreshRateToggle and shareToggle', t => {
  let addEventListener = () => {};
  let postMessage = () => {};
  let worker = getWorker(addEventListener, postMessage);

  registerWorker(worker);
  let {refreshRateToggle, shareToggle, shareContent, refreshContent} = loadActionPanel();

  // Both should initially be off
  t.is(shareContent.classList.contains('toggle'), false);
  t.is(refreshContent.classList.contains('toggle'), false);

  // Toggle refresh on
  refreshRateToggle.click();
  t.is(shareContent.classList.contains('toggle'), false);
  t.is(refreshContent.classList.contains('toggle'), true);

  // toggle refresh off
  refreshRateToggle.click();
  t.is(shareContent.classList.contains('toggle'), false);
  t.is(refreshContent.classList.contains('toggle'), false);

  // toggle share on
  shareToggle.click();
  t.is(shareContent.classList.contains('toggle'), true);
  t.is(refreshContent.classList.contains('toggle'), false);

  // toggle share off
  shareToggle.click();
  t.is(shareContent.classList.contains('toggle'), false);
  t.is(refreshContent.classList.contains('toggle'), false);

  // toggle refresh on
  refreshRateToggle.click();
  t.is(shareContent.classList.contains('toggle'), false);
  t.is(refreshContent.classList.contains('toggle'), true);

  // toggle share on (which turns off refresh)
  shareToggle.click();
  t.is(shareContent.classList.contains('toggle'), true);
  t.is(refreshContent.classList.contains('toggle'), false);

  // annnd back to refresh on
  refreshRateToggle.click();
  t.is(shareContent.classList.contains('toggle'), false);
  t.is(refreshContent.classList.contains('toggle'), true);
});

test('hasRefreshed', t => {

  global.document = require('jsdom').jsdom('<body><div id="refreshRateToggle"></div></body>');
  let refreshRateToggle = global.document.getElementById('refreshRateToggle');

  t.is(refreshRateToggle.classList.contains('hasRefreshed'), false);
  hasRefreshed();
  t.is(refreshRateToggle.classList.contains('hasRefreshed'), true);

  return new Promise(function(resolve) {
    setTimeout(() => {
      t.is(refreshRateToggle.classList.contains('hasRefreshed'), false);
      resolve();
    }, 500)
  });

});

test('updateShareLink', t => {

  global.document = require('jsdom').jsdom(`<body><div id="repoSection"></div><textarea id="shareUrl"></textarea></body>`);

  let repoSection = document.getElementById('repoSection');
  let shareUrl = document.getElementById('shareUrl');
  updateShareLink('http://localhost:5000');

  t.is(shareUrl.value, 'http://localhost:5000');

  let repo = document.createElement('div');
  repo.setAttribute('data-url', 'test/test');
  repoSection.appendChild(repo);

  updateShareLink('http://localhost:5000');
  t.is(shareUrl.value, 'http://localhost:5000?share=test/test');

  repo = document.createElement('div');
  repo.setAttribute('data-url', 'test2/test2');
  repoSection.appendChild(repo);

  updateShareLink('http://localhost:5000');
  t.is(shareUrl.value, 'http://localhost:5000?share=test/test,test2/test2');
});

/**
 * If the user doesn't pass in `SHOW_APP_DESCRIPTION=true`,
 * then the #moreInfoToggle won't exist on the page (why show a button that does nothing?)
 *
 * We don't want to attempt to bind an event listener to null, so we conditionally `addEventListener`.
 * This test is just a sanity check to make sure the app still works properly with/without that element.
 */
test('missing moreInfoToggle doesn\'t explode the app', t => {
  global.document = require('jsdom').jsdom(`
    <div id="octoshelf"><div id="repoSection"></div></div>
    <span class="infoPanel-actions">
      <a href="#" class="octicon octicon-clock infoPanel-action refreshRate-toggle" id="refreshRateToggle"></a>
      <a href="#" class="octicon octicon-broadcast infoPanel-action notification-button" id="requestNotifications"></a>
      <a href="#" id="toggleViewType" class="octicon octicon-three-bars infoPanel-action toggleViewType"></a>
      <a href="#" id="shareToggle" class="octicon octicon-link infoPanel-action share-toggle"></a>
      <span class="toggleContentContainer">
          <span id="refreshContent" class="refreshRate_moreInfo">
              <div>Refresh Rate</div>
              <ul class="refreshRate_options" id="refreshRateOptions">
                  <li>
                      <label class="refreshRate_option">
                          <input class="refreshRate_input" type="radio" name="refreshRate" value="0" id="refresh_0" />
                          <span class="refreshRate_inputDisplay">None</span>
                      </label>
                  </li>
                  <li>
                      <label class="refreshRate_option">
                          <input id="refresh_60000" class="refreshRate_input" type="radio" name="refreshRate"  value="60000" checked="checked" />
                          <span class="refreshRate_inputDisplay">1 min</span>
                      </label>
                  </li>
                  <li>
                      <label class="refreshRate_option">
                          <input class="refreshRate_input" type="radio" name="refreshRate" value="300000" />
                          <span class="refreshRate_inputDisplay">5 mins</span>
                      </label>
                  </li>
              </ul>
          </span>
          <span id="shareContent" class="share-content">
              <span>Share These Repos:</span>
              <textarea class="share-urlInput" id="shareUrl" readonly onClick="this.setSelectionRange(0, this.value.length)"></textarea>
          </span>
      </span>
    </span>
   `);
  delete require.cache[require.resolve('../public/scripts/actionPanel')];
  let actionPanel = require('../public/scripts/actionPanel');

  actionPanel.loadActionPanel();
  t.pass();
});
