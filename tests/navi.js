
import test from 'ava';

import {sendLinkNotification, sendWebNotification} from '../public/scripts/navi';

test('sendLinkNotification should emit a notification that self-closes', t => {

  return new Promise(function(resolve) {
    let closeDuration = 1000;
    let isClosed = false;
    let Notification = (notifyTitle, {body, icon}) => {
      t.is(notifyTitle, 'notifyTitle');
      t.is(body, 'notifyBody');
      t.is(icon, '/images/octoshelf-icon-dark.jpg');
      return {
        close: () => {
          isClosed = true;
          t.pass();
        }
      }
    };
    Notification.permission = 'granted';
    global.Notification = Notification;
    sendLinkNotification({title: 'notifyTitle', body: 'notifyBody', url: 'notifyUrl', duration: closeDuration});

    setTimeout(() => {
      t.is(isClosed, true);
      resolve();
    }, closeDuration);
  });
});

test('sendLinkNotification should trigger a window.open when clicked', t => {

  let closeDuration = 1000;
  let Notification = () => {
    return {
      close: () => {}
    }
  };
  Notification.permission = 'granted';
  global.Notification = Notification;
  global.window.open = (url, windowName) => {
    t.is(url, 'notifyUrl');
    t.is(windowName, '_blank');
    t.pass();
  };
  let myNotification = sendLinkNotification({title: 'notifyTitle', body: 'notifyBody', url: 'notifyUrl', duration: closeDuration});

  let fakeEvent = {
    preventDefault(){}
  };
  myNotification.onclick(fakeEvent);
});

test('sendLinkNotification should not create a notification without a url', t => {

  let Notification = () => {
    t.fail();
  };
  Notification.permission = 'granted';
  global.Notification = Notification;
  sendLinkNotification({title: 'notifyTitle', body: 'notifyBody', url: '', duration: 1000});
});

test('sendLinkNotification should not create a notification if permission is denied', t => {

  let Notification = () => {
    t.fail();
  };
  Notification.permission = 'denied';
  global.Notification = Notification;
  sendLinkNotification({title: 'notifyTitle', body: 'notifyBody', url: 'notifyUrl', duration: 1000});
});

test('sendLinkNotification should not create a notification with foreign permissions', t => {

  let Notification = () => {
    t.fail();
  };
  Notification.permission = 'asdf';
  global.Notification = Notification;
  sendLinkNotification({title: 'notifyTitle', body: 'notifyBody', url: 'notifyUrl', duration: 1000});
});

test('sendWebNotification should not blow up without a click handler or duration', t => {
  let Notification = () => {
    return {
      close: () => {}
    }
  };
  Notification.permission = 'granted';
  global.Notification = Notification;
  let myNotification = sendWebNotification('notifyTitle', 'notifyBody');
  t.not(myNotification.onclick, null);
  myNotification.onclick();
  t.pass();
});
