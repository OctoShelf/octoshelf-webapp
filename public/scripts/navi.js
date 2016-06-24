/**
 * HEY!  HEY LISTEN!
 * Navi is responsible for sending out web and mobile notifications
 */

import {registerWorkerEventHandles} from './conductor';

/**
 * If Notifications are permitted, send out a notification.
 * @param {String} title - notification title
 * @param {String} body - notification body
 * @param {Function} onclick - notification onclick
 * @param {Number} duration - notification duration before it self-closes (defaults to 5 seconds)
 * @return {Notification|null} - either return the newly created notification, or return null
 */
export function sendWebNotification(title, body, onclick = () => {}, duration = 5000) {
  let {permission} = Notification;
  let permissionMap = {
    granted() {
      let notification = new Notification(title, {
        body,
        icon: '/images/octoshelf-icon-dark.jpg'
      });
      notification.onclick = event => {
        onclick(event);
        notification.close();
      };
      setTimeout(notification.close.bind(notification), duration);
      return notification;
    },
    // no-op
    denied() {}
  };

  return permissionMap[permission] ? permissionMap[permission]() : null;
}

/**
 * Attempt to send a notification with a window.open onclick handler
 * @param {String} title - notification title
 * @param {String} body - notification body
 * @param {String} url - notification url
 * @param {Number} duration - duration of time notification should live
 * @return {Notification|null} - return either a newly created notification, or null
 */
export function sendLinkNotification({title, body, url, duration}) {
  if (!url) {
    return null;
  }
  return sendWebNotification(title, body, event => {
    event.preventDefault();
    window.open(url, '_blank');
  }, duration);
}

registerWorkerEventHandles('Notifications', {
  sendLinkNotification
});
