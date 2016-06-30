'use strict';

import {log, notify} from './utilities';
import {loadActionPanel} from './actionPanel';
import {loadAnimations} from './animations';
import {loadAddRepoSection} from './addRepo';
import {loadRepoSection} from './repoSection';
import './navi';

import {workerPostMessage, registerWorkerEventHandles} from './conductor';
const postMessageToWorker = workerPostMessage('OctoShelf');

let accessToken = '';
let apiUrl = 'https://api.github.com';
let githubUrl = 'https://github.com/';

let sharedReposString = '';
let sharedRepos = [];

/**
 * Initialize the app with a bunch of variables defining github endpoints
 * @param {Object} apiVariables -  Object that defines several github api values
 */
function initAPIVariables(apiVariables) {
  githubUrl = apiVariables.githubUrl;
  sharedRepos = apiVariables.sharedRepos;
  postMessageToWorker('initAPIVariables', apiVariables);
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
  githubUrl = options.githubUrl || githubUrl;
  accessToken = options.accessToken || accessToken;
  apiUrl = options.apiUrl || apiUrl;

  sharedReposString = options.sharedRepos || sharedReposString;
  sharedRepos = sharedReposString.split(',');

  let apiOptions = {accessToken, apiUrl, githubUrl, sharedRepos};

  /**
   * Initialize the app!
   */
  initAPIVariables(apiOptions);

  // Load event listeners
  loadAnimations();
  loadActionPanel();
  loadAddRepoSection(apiOptions);
  loadRepoSection(apiOptions);
}

registerWorkerEventHandles('OctoShelf', {log, notify});
