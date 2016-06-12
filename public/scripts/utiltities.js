
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

  if (console && console.log) {
    if (console.group && otherMessages.length) {
      console.group(message);
      otherMessages.forEach(msg => console.log(msg));
      console.groupEnd(message);
      return;
    }
    console.log(message);
  }
}
