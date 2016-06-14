/**
 * Conductor - He conducts traffic to and from the web worker.
 *
 * Conductor acts as a web worker mediator. Its purpose is to decouple modules
 * from postMessaging and listening to the web worker directly.
 *
 * Instead of connecting OctoShelf.js with the Web Worker directly
 * (forcing function calls to pass through OctoShelf.js), we can
 * register eventHandlers using `registerWorkerEventHandles`.
 *
 * Instead of passing around the web worker to execute postMessages,
 * we can call `workerPostMessage(source)`, which returns a postMessage
 * function for us. (bonus, we track the originating source of the postMessage)
 *
 * Example Usages:
 *
 * import {registerWorkerEventHandles, workerPostMessage} from './conductor';
 *
 * let postMessageToWorker = workerPostMessage('TestUtility');
 *
 * // Send a message to the worker
 * postMessageToWorker('workerFn', [1,2,3])
 *
 * // Register events from the worker
 * registerWorkerEventHandles('TestUtility', {assert, log, should});
 *
 */

import {log} from './utiltities';

const registeredFns = {};
const nameMap = {};
let appWorker;

/**
 * Send a Parsed Post Message to the web worker
 * @param {String} fnName - function we will attempt to call
 * @param {*} postData - Some data that we will wrap into a stringified object
 */
function postMessageToWorker(fnName, postData) {
  if (!(appWorker && appWorker.postMessage)) {
    log('Web Worker has not been registered');
    return;
  }
  appWorker.postMessage([fnName, JSON.stringify({postData})]);
}

/**
 * Execute function mapped to worker's post message
 * @param {Function} fn - function to call
 * @param {Function} fnName - function name
 * @param {String} params - Stringified object that contains a postData prop
 */
function executeWorkerEventHandle(fn, fnName, params) {
  let parsedParams = JSON.parse(params);
  let {postData} = parsedParams;
  if (fnName !== 'log') {
    log(`[Worker] -> [${nameMap[fnName]}] "${fnName}" called with:`, postData);
  }
  fn(postData);
}

/**
 * Register a worker for posting messages to (and listening for post messages from)
 * @param {Worker} worker - our web worker
 */
export function registerWorker(worker) {
  appWorker = worker;
  appWorker.addEventListener('message', function({data: [fnName, fnData]}) {
    if (registeredFns[fnName]) {
      return executeWorkerEventHandle(registeredFns[fnName], fnName, fnData);
    }
    log(`"${fnName}" was not part of the allowed postMessage functions`);
  });
}

/**
 * Register a series of functions mapped to a handler
 * @param {String} handlerName - Owner of the event Handler (for logging)
 * @param {Object} newFns - object of functions
 */
export function registerWorkerEventHandles(handlerName, newFns) {
  Object.assign(registeredFns, newFns);
  Object.keys(newFns).forEach(fnName => {
    nameMap[fnName] = handlerName;
  });
}

/**
 * High order function that returns a postMessage function
 * @param {String} source - postMessage source (for logging)
 * @return {Function} postMessage function
 */
export function workerPostMessage(source) {
  return (fnName, postData) => {
    log(`[${source}] -> [Worker] "${fnName}" called with:`, postData);
    postMessageToWorker(fnName, postData);
  };
}
