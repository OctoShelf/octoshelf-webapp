
import OctoShelf from '../scripts/octoshelf.js';
import config from '../../config/config.json';

import {registerWorker} from '../scripts/conductor.js';
const OctoWorker = require("../scripts/octo.worker.js");
registerWorker(new OctoWorker());

const serverConfig = hydratedConfig || {};
const initConfig = Object.assign({}, config, serverConfig);

// Execute an OctoShelf and we now have a webapp
OctoShelf(initConfig);