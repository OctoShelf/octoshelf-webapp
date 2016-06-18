
import 'babel-register';
import test from 'ava';
import './helpers/setup-browser-env.js';

let worker;
let conductor;
let registerWorker, registerWorkerEventHandles, workerPostMessage;

test.beforeEach(t => {
  delete require.cache[require.resolve('../public/scripts/conductor')];
  conductor = require('../public/scripts/conductor');
  registerWorker = conductor.registerWorker;
  registerWorkerEventHandles = conductor.registerWorkerEventHandles;
  workerPostMessage = conductor.workerPostMessage;
  worker = {
    fns: {},
    postMessage(message) {

      if (!message) {
        message = [];
      }

      let fnName = message[0];
      let postData = message[1];
      if (this.fns.message) {
        this.fns.message({
          data: [fnName, postData]
        });
      }
    },
    addEventListener(type, fn) {
      this.fns[type] = fn;
    }
  };
});

test('Register and postMessage', t => {
  // Register a worker
  registerWorker(worker);

  // Register a bunch of functions
  registerWorkerEventHandles('Potato', {
    putThemInAStew(data) {
      t.is(data, 'smash them');
      t.pass();
    }
  });
  let postMessager = workerPostMessage('Potato');
  postMessager('putThemInAStew', 'smash them');
});

test('should not crash if a worker isn\'t registered', t => {

  registerWorker(null);

  // Register a bunch of functions
  registerWorkerEventHandles('Potato', {
    putThemInAStew(data) {
      // will not get triggered
      t.fail();
    }
  });
  let postMessager = workerPostMessage('Potato');
  postMessager('putThemInAStew', 'smash them');
  t.pass();
});

test('should not crash if an unregistered function is called', t => {

  registerWorker(worker);

  // Register a bunch of functions
  registerWorkerEventHandles('Potato', {
    putThemInAStew() {
      t.fail(); // will not get triggered
    }
  });
  let postMessager = workerPostMessage('Potato');
  postMessager('travelToMordor', 'return the ring');
  t.pass();
});

test('should still call functions if a registered name is not provided', t => {

  registerWorker(worker);

  // Register a bunch of functions
  registerWorkerEventHandles(null, {
    putThemInAStew() {
      t.pass(); // will not get triggered
    }
  });
  let postMessager = workerPostMessage(null);
  postMessager('putThemInAStew', 'smash them');
});

test('should not double call log', t => {

  registerWorker(worker);

  // Register a bunch of functions
  registerWorkerEventHandles('Logarithm', {
    log(data) {
      t.is(data, 'Should only get logged once');
      t.pass();
    }
  });
  let postMessager = workerPostMessage('Logarithm');
  postMessager('log', 'Should only get logged once');
});
