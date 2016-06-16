
import 'babel-register';
import test from 'ava';
import './helpers/setup-browser-env.js';

import {registerWorker} from '../public/scripts/conductor';

let hasRefreshed;
let updateShareLink;
let loadActionPanelListeners;

function resetDOMAndActionPanel() {
  global.document = require('jsdom').jsdom(`
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
  loadActionPanelListeners = actionPanel.loadActionPanelListeners;
}

/**
 * Return a fake worker. We aren't testing communicating back and forth between
 * the worker and other modules, so all we really need to do is spoof a worker
 * by passing in adEventListener and postMessage functions.
 * @param {Function} addEventListener - gets called when worker is registered
 * @param {Function} postMessage - gets called when modules do a postMessage to conductor
 * @return {Object} Fake Worker
 */
function getWorker(addEventListener, postMessage) {
  return {
    addEventListener,
    postMessage
  };
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
  loadActionPanelListeners();
});

test('toggling refreshRate changes', t => {

  return new Promise(function(resolve) {

    let {refreshRateOptions} = loadActionPanelListeners();

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
