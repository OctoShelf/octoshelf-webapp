/**
 * RepoStateManager - Abstracts away persisting repository urls and CRUDs.
 * Should we decide to change to a cookie, session storage, etc, we can
 * simply update it here, and not have to worry about a stray localStorage
 * elsewhere.
 */

// An array of repository urls
let repositories = [];
  // A set of unique repository urls, used to prevent duplicates being added
let uniqueRepos = new Set();

/**
 * Add a repo url to local state
 * @param {String} url - url to add
 */
export function addLocalRepo(url) {
  if (!uniqueRepos.has(url)) {
    uniqueRepos.add(url);
    repositories.push(url);
    localStorage.setItem('repositories', JSON.stringify(repositories));
  }
}

/**
 * Remove a repo url from local state
 * @param {String} url - url to remove
 */
export function removeLocalRepo(url) {
  repositories = repositories.filter(repoUrl => repoUrl !== url);
  uniqueRepos.delete(url);
  localStorage.setItem('repositories', JSON.stringify(repositories));
}

/**
 * Get all the repos from local storage
 * @return {Array} repositories - array of the repository urls
 */
export function getLocalRepos() {
  let repoString = localStorage.getItem('repositories') || '[]';
  repositories = JSON.parse(repoString);
  repositories.forEach(url => {
    uniqueRepos.add(url);
  });
  return repositories;
}
