

/**
 * Return a fake worker. We aren't testing communicating back and forth between
 * the worker and other modules, so all we really need to do is spoof a worker
 * by passing in addEventListener and postMessage functions.
 * @param {Function} addEventListener - gets called when worker is registered
 * @param {Function} postMessage - gets called when modules do a postMessage to conductor
 * @return {Object} Fake Worker
 */
export function getWorker(addEventListener, postMessage) {
  return {
    fns: {},
    addEventListener,
    postMessage
  };
}