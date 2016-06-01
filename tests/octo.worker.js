
import 'babel-register';
import test from 'ava';
import './helpers/setup-browser-env.js';
import worker from '../public/scripts/octo.worker';


test('web worker addRepo', t => {

  t.is(worker.repositories.length, 0);
  t.is(worker.repositoriesSet.has('test'), false);
  worker.addRepo('test');
  t.is(worker.repositories.length, 1);
  t.is(worker.repositoriesSet.has('test'), true);
});
