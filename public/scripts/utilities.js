
let logsEnabled = true;

/**
 * Log a message to console (if console exists)
 * @param {String} message - message to log (or group)
 * @param {String|Object} extraStuff - extra stuff to log inside message group
 */
export function log() {
  let args = Array.from(arguments);
  let message = args[0];
  let otherMessages = args.slice(1);
  if (message instanceof Array) {
    otherMessages.push(message[1]);
    message = message[0];
  }

  if (console && console.log && logsEnabled) {
    if (console.group && otherMessages.length) {
      console.group(message);
      otherMessages.forEach(msg => console.log(msg));
      console.groupEnd(message);
      return;
    }
    console.log(message);
  }
}

/**
 * Notify the user something happened
 * @param {String} notifyText - Text we want displayed
 * @param {Number} duration - duration that the notification will linger
 */
export function notify(notifyText, duration = 1000) {
  let notifications = document.getElementById('notifications');
  let notification = document.createElement('div');
  notification.setAttribute('class', 'notification');

  notifications
    .appendChild(notification)
    .appendChild(document.createTextNode(notifyText));

  setTimeout(function() {
    notification.classList.add('fadeOut');
    setTimeout(function() {
      notifications.removeChild(notification);
    }, 500);
  }, duration);
}

/**
 * Logs are super noisy during tests.
 * This helper function blocks console output
 */
export function shh() {
  logsEnabled = false;
}
