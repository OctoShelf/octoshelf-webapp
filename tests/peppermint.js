
import test from 'ava';

import Peppermint from '../public/scripts/peppermint';

test('should call refreshFn', t => {
  let peppermint = Peppermint(() => t.pass());
  peppermint.startRefreshing(1);
});

test('should call refreshFn repeatedly', t => {
  let countDown = 2;
  let peppermint = Peppermint(() => {
    if (!countDown) {
      t.pass()
    }
    countDown--;
  });
  peppermint.startRefreshing(1);
});

test('should reset previous refresh rates', t => {
  let countDown = 0;
  let peppermint = Peppermint(() => {
    peppermint.startRefreshing(1000);
    countDown++;
  });
  peppermint.startRefreshing(1);
  setTimeout(() => {
    t.is(countDown, 1);
  }, 100)
});

test('should stop calling refreshFn once its turned off', t => {
  let countDown = 1;
  let peppermint = Peppermint(() => {
    countDown--;
    if (!countDown) {
      return peppermint.stopRefreshing();
    }
    t.fail();
  });
  peppermint.startRefreshing(1);
});
