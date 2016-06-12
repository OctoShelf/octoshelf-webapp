/**
 * Peppermint is wintery fresh, and refreshes all the time.
 * @param {Function} refreshFn - function you want called for each refreshed
 * @return {Object} Peppermint
 */
export default function Peppermint(refreshFn) {
  let refreshTimeout;
  return {
    refreshStep(delay) {
      refreshFn();
      refreshTimeout = setTimeout(() => this.refreshStep(delay), delay);
    },
    startRefreshing(delay) {
      if (refreshTimeout) {
        this.stopRefreshing();
      }
      refreshTimeout = setTimeout(() => this.refreshStep(delay), delay);
    },
    stopRefreshing() {
      clearTimeout(refreshTimeout);
    }
  };
}
