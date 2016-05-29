
let repoSection = document.getElementById('repoSection');
let syncAll = document.getElementById('syncAll');
let addRepoForm = document.getElementById('addRepoForm');
let addRepoInput = document.getElementById('addRepoInput');


addRepoForm.addEventListener('submit', function(event) {

  event.preventDefault();
  addRepo(addRepoInput.value);
  addRepoInput.value = '';
});
syncAll.addEventListener('click', function(event) {
  event.preventDefault();
  repositories.forEach(repository => getRepoDetails(repository));
});
repoSection.addEventListener('click', function(event) {
  event.preventDefault();

  let { action, id } = event.target && event.target.dataset;

  // TODO: clean this up so its not a if ladder
  if (action === 'refresh') {
    let repository = repositoriesMap.get(id);
    return getRepoDetails(repository);
  }
});

// TODO: Add everything below this to a WebWorker
let repositories = [];
let repositoriesSet = new Set();
let repositoriesMap = new Map();

let repository = {
  url: '',
  placeholderUpdated: false,
  fetchedDetails: false
};

/**
 * Given a PR Object (from Github's API), return a slimmer version
 */
function simplifyPR({ id, title, body, html_url:url }) {
  return { id, title, body, url };
}

/**
 * Add a Repo to our repos array
 * @param url
 */
function addRepo(url) {
  if (repositoriesSet.has(url)) {
    return;
  }

  let newRepository = Object.assign({}, repository, {
    prs: [],
    url: url
  });

  repositories.push(newRepository);
  repositoriesSet.add(url);

  let placeholder = drawPlaceholderRepo(newRepository);
  return getRepoDetails(newRepository, placeholder);
}

/**
 * Fetch Details about a Repo (title, etc)
 * @param apiUrl
 * @returns {*}
 */
function fetchRepoDetails(apiUrl) {
  return fetch(`https://api.github.com/repos/${apiUrl}`)
}

/**
 * Fetch a Repo's Pull Requests
 * @param apiUrl
 * @returns {*}
 */
function fetchRepoPulls(apiUrl) {
  return fetch(`https://api.github.com/repos/${apiUrl}/pulls`)
}

/**
 * Fetch a Repo's details and open pull requests
 * @param apiUrl
 * @returns {Promise.<T>}
 */
function fetchRepo(apiUrl){
  return Promise.all([fetchRepoDetails(apiUrl), fetchRepoPulls(apiUrl)])
    .then(([repoDetails, repoPulls]) => {
      return Promise.all([repoDetails.json(), repoPulls.json()])
    });
}

function getRepoDetails(repository, placeholder) {

  let { url, fetchedDetails } = repository;

  // TODO: Update this to allow for corp github instances
  let apiUrl = url.replace('https://github.com/', '');

  // If we already got the repository details, lets only fetch pull requests
  if (fetchedDetails) {

    return fetchRepoPulls(apiUrl)
      .then(repoPulls => repoPulls.json())
      .then(repoPulls => {
        repository.prs = repoPulls.map(simplifyPR);
      })
      .then(() => {
        updateRepository(repository, placeholder);
      });
  }

  fetchRepo(apiUrl)
    .then(([{ id, full_name}, repoPulls]) => {
      repository.id = id;
      repository.name = full_name;
      repository.prs = repoPulls.map(simplifyPR);
      repository.fetchedDetails = true;

      repositoriesMap.set(''+id, repository);
    })
    .then(() => {
      updateRepository(repository, placeholder);
    });
}

/**
 * Draw a simple placeholder repo into the repoSection.
 * Later we will fill up the drawn element with more data.
 * @param url {String}
 * @returns {Element}
 */
function drawPlaceholderRepo({ url }) {

  let article = document.createElement('article');
  let header = document.createElement('header');
  let title = document.createElement('span');
  title.setAttribute('class', 'repo-title');

  let sync = document.createElement('a');
  sync.setAttribute('href', '#');
  sync.setAttribute('class', 'octicon octicon-sync');
  sync.setAttribute('data-action', 'refresh');
  sync.setAttribute('data-id', '');

  let prListItems = document.createElement('ul');
  prListItems.setAttribute('class', 'prList');

  repoSection
    .appendChild(article)
    .appendChild(header)
    .appendChild(title)
    .appendChild(document.createTextNode(url));

  header.appendChild(sync);

  repoSection
    .appendChild(article)
    .appendChild(prListItems);

  return article;
}

function updateRepository(repository, placeholder) {

  let { id, name, placeholderUpdated, prs } = repository;
  let article = document.getElementById(id) || placeholder;

  if (!article) {
    article = drawPlaceholderRepo(repository)
  }

  // If we have not had the opportunity to the DOM earlier, do it now.
  if (!placeholderUpdated) {
    // If there wasn't an id before, set it now
    if (!article.id) {
      article.setAttribute('id', id);
    }

    let sync = article.querySelector('.octicon-sync');
    sync.setAttribute('data-id', id);

    // Swap out the title with a better one
    let repoTitle = article.querySelector('.repo-title');
    repoTitle.innerText = name;

    repository.placeholderUpdated = true;
  }

  let prListItems = article.querySelector('.prList');
  let pullRequestFragment = document.createDocumentFragment();

  prs.forEach(({ id, title, url }) => {

    let prListItem = document.createElement('li');
    let prLink = document.createElement('a');
    let prMoreInfo = document.createElement('span');


    prListItem.setAttribute('id', id);

    prLink.setAttribute('href', url);
    prLink.setAttribute('target', '_blank');
    prLink.setAttribute('class', 'prLink octicon octicon-git-pull-request');

    prListItem.classList.add('prListItem');
    prMoreInfo.classList.add('prMoreInfo');

    pullRequestFragment
      .appendChild(prListItem)
      .appendChild(prLink)
      .appendChild(prMoreInfo)
      .appendChild(document.createTextNode(title));
  });

  prListItems.innerHTML = '';
  prListItems.appendChild(pullRequestFragment);
}