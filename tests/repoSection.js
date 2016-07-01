
import test from 'ava';

import {registerWorker} from '../public/scripts/conductor';

let loadRepoSection;
let toggleLoadingRepository;
let drawPlaceholderRepo;
let removeRepository;
let updateRepository;
let removeNewPullRequestAnimations;
let animateNewPullRequests;

test.beforeEach(() => {
  let {shh} = require('../public/scripts/utilities');
  shh();
  global.document = require('jsdom').jsdom(`
    <div id="octoshelf">
      <section class="app-repositoriesWrapper">
          <section id="repoSection" class="app-repositories">
            <article class="bubble repository" data-url="octoshelf/octoshelf-webapp">
              <div class="repositoryInner" style="transform: rotate(-0deg);">
                <header>
                  <span class="repo-title" title="OctoShelf/octoshelf-webapp">octoshelf-webapp</span>
                </header>
                <ul class="prList"></ul>
                <div>
                  <a href="https://github.com/octoshelf/octoshelf-webapp" target="blank" data-action="" class="octicon octicon-repo action" data-url="octoshelf/octoshelf-webapp" data-id="59803443"></a>
                  <a href="#" target="blank" data-action="refresh" class="octicon octicon-sync action" data-url="octoshelf/octoshelf-webapp" data-id="59803443"></a><a href="#" target="blank" data-action="remove" class="octicon octicon-x action" data-url="octoshelf/octoshelf-webapp" data-id="59803443"></a>
                </div>
              </div>
            </article>
          </section>
      </section>
      <section id="actionPanel"><textarea id="shareUrl"></textarea></section>
      <section id="notifications"></section>
    </div>
   `);
  delete require.cache[require.resolve('../public/scripts/repoSection')];
  let repoSection = require('../public/scripts/repoSection');

  loadRepoSection = repoSection.loadRepoSection;
  toggleLoadingRepository = repoSection.toggleLoadingRepository;
  drawPlaceholderRepo = repoSection.drawPlaceholderRepo;
  removeRepository = repoSection.removeRepository;
  updateRepository = repoSection.updateRepository;
  removeNewPullRequestAnimations = repoSection.removeNewPullRequestAnimations;
  animateNewPullRequests = repoSection.animateNewPullRequests;
});


test('removeRepository should remove a repository', t => {
  let repoSection = global.document.getElementById('repoSection');
  t.is(global.document.getElementById('repoSection').children.length, 1);
  removeRepository('octoshelf/octoshelf-webapp');
  t.is(global.document.getElementById('repoSection').children.length, 0);
});

test('removing a non-existant repository should notify what happened', t => {
  removeRepository('notHere/notHere');
  let firstNotification = global.document.getElementById('notifications').firstElementChild;
  t.is(firstNotification.textContent, 'notHere/notHere doesn\'t exist on the page');
  t.pass();
});

test('toggleLoadingRepository should add and remove loading class', t => {
  let repo = global.document.getElementById('repoSection').firstElementChild;

  t.is(repo.classList.contains('loading'), false);
  toggleLoadingRepository(['octoshelf/octoshelf-webapp', true]);
  t.is(repo.classList.contains('loading'), true);
  toggleLoadingRepository(['octoshelf/octoshelf-webapp', false]);
  t.is(repo.classList.contains('loading'), false);
});

test('toggleLoadingRepository a non-existant repo should notify', t => {
  toggleLoadingRepository(['notHere/notHere', true]);
  let firstNotification = global.document.getElementById('notifications').firstElementChild;
  t.is(firstNotification.textContent, 'notHere/notHere doesn\'t exist on the page');
});

test.todo('loadRepoSection');
test.todo('drawPlaceholderRepo');
test.todo('updateRepository');
test.todo('removeNewPullRequestAnimations');
test.todo('animateNewPullRequests');
