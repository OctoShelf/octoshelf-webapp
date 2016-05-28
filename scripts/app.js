
let repoSection = document.getElementById('repoSection');
let addRepoForm = document.getElementById('addRepoForm');
let addRepoInput = document.getElementById('addRepoInput');


addRepoForm.addEventListener('submit', function(event) {

  event.preventDefault();
  addRepo(addRepoInput.value);
  addRepoInput.value = '';
});


// TODO: Add everything below this to a WebWorker
let repositories = [];
let repositoriesSet = new Set();

let repository = {
  url: '',
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

  drawEverything();
  return getRepoDetails(newRepository);
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

function getRepoDetails(repository) {

  let { url, fetchedDetails } = repository;

  if (fetchedDetails) {
    return drawEverything();
  }

  // TODO: Update this to allow for corp github instances
  let apiUrl = url.replace('https://github.com/', '');

  fetchRepo(apiUrl)
    .then(([{ id, name}, repoPulls]) => {
      repository.id = id;
      repository.name = name;
      repository.prs = repoPulls.map(simplifyPR);
      repository.fetchedDetails = true;
    })
    .then(drawEverything);

}


function drawEverything () {

  let fragment = document.createDocumentFragment();

  repositories.forEach(function({ id, name, url, prs }) {

    let article = document.createElement('article');
    let header = document.createTextNode(name || url);

    article.setAttribute('id', id);

    let prSection = document.createElement('ul');
    prs.forEach(({ id, title, body, url }) => {

      let prListItem = document.createElement('li');
      let prLink = document.createElement('a');
      let prMoreInfo = document.createElement('span');

      prListItem.setAttribute('id', id);
      prLink.setAttribute('href', url);
      prLink.setAttribute('title', title);
      prMoreInfo.appendChild(document.createTextNode(title));

      prListItem.classList.add('prListItem');
      prMoreInfo.classList.add('prMoreInfo');

      prSection
        .appendChild(prListItem)
        .appendChild(prLink)
        .appendChild(document.createTextNode('PR'));

      prListItem.appendChild(prMoreInfo);
    });


    article.appendChild(header);
    article.appendChild(prSection);
    fragment.appendChild(article);
  });

  repoSection.innerHTML = '';
  repoSection.appendChild(fragment);
}