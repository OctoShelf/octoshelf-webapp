
console.log('ONE DOLLAR AND EIGHTY-SEVEN CENTS.');

var addRepo = document.getElementById('addRepo');
var addUser = document.getElementById('addUser');

var addRepoInput = document.getElementById('addRepoInput');
var addUserInput = document.getElementById('addUserInput');

addRepo.addEventListener('submit', function(event) {
  event.preventDefault();
  addRepoInput.value = '';
});

addUser.addEventListener('submit', function(event) {
  event.preventDefault();
  addUserInput.value = '';
});