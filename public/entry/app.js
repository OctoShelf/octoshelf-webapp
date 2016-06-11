
import OctoShelf from '../scripts/octoshelf.js';
import config from '../../config/config.json';

const OctoWorker = require("../scripts/octo.worker.js");
const appWorker = new OctoWorker();

const serverConfig = hydratedConfig || {};
const initConfig = Object.assign({}, config, serverConfig);

const appElement = document.getElementById('octoshelf');

// Execute an OctoShelf and we now have a webapp
OctoShelf(appElement, initConfig, appWorker);