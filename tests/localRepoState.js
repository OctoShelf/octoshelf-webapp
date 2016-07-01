
import test from 'ava';

import {registerWorker} from '../public/scripts/conductor';

let addLocalRepo;
let removeLocalRepo;
let getLocalRepos;
let fetchLocalRepos;

test.beforeEach(() => {
  let {shh} = require('../public/scripts/utilities');
  shh();
  delete require.cache[require.resolve('../public/scripts/localRepoState')];
  let localRepoState = require('../public/scripts/localRepoState');

  addLocalRepo = localRepoState.addLocalRepo;
  removeLocalRepo = localRepoState.removeLocalRepo;
  getLocalRepos = localRepoState.getLocalRepos;
  fetchLocalRepos = localRepoState.fetchLocalRepos;
});

test('add and get a localRepo', t => {
  addLocalRepo('octoshelf/octoshelf-webapp');
  let repos = getLocalRepos();
  t.is(repos[0], 'octoshelf/octoshelf-webapp');
});

test('duplicates should not get added', t => {
  addLocalRepo('octoshelf/octoshelf-webapp');
  addLocalRepo('octoshelf/octoshelf-webapp');

  let repos = getLocalRepos();
  t.is(repos[0], 'octoshelf/octoshelf-webapp');
  t.is(repos.length, 1);
});

test('removeLocalRepo', t => {
  addLocalRepo('octoshelf/octoshelf-webapp');
  let repos = getLocalRepos();
  t.is(repos.length, 1);

  removeLocalRepo('octoshelf/octoshelf-webapp');
  repos = getLocalRepos();
  t.is(repos.length, 0);
});

test('getLocalRepos', t => {
  addLocalRepo('octoshelf/octoshelf-webapp');
  addLocalRepo('octoshelf/docs');
  t.deepEqual(getLocalRepos(), ['octoshelf/octoshelf-webapp', 'octoshelf/docs']);
});

test('getLocalRepos should not blow up if empty', t => {
  global.localStorage.items = {};
  getLocalRepos();
  t.pass();
});