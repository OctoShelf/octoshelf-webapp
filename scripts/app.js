
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


function addRepo(url) {
  if (repositoriesSet.has(url)) {
    return;
  }

  let newRepository = Object.assign({}, repository, {
    prs: [],
    issues: [],
    url: url
  });

  repositories.push(newRepository);
  repositoriesSet.add(url);

  getRepoDetails(newRepository);
  drawEverything();
}

function getRepoDetails(repository) {

  let { url, fetchedDetails } = repository;

  if (fetchedDetails) {
    return drawEverything();
  }

  // TODO: Update this to allow for corp github instances
  let apiUrl = url.replace('https://github.com/', '');

  fetch(`https://api.github.com/repos/${apiUrl}`)
    .then(response => response.json())
    .then(response => {
      repository.name = response.name;
      repository.fetchedDetails = true;
    })
    .then(drawEverything);
}


function drawEverything () {

  let fragment = document.createDocumentFragment(),
    article,
    header;

  repositories.forEach(function({ name, url }) {
    article = document.createElement('article');
    header = document.createTextNode(name || url);
    article.appendChild(header);
    fragment.appendChild(article);
  });

  repoSection.innerHTML = '';
  repoSection.appendChild(fragment);
}