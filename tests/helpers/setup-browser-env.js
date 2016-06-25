global.document = require('jsdom').jsdom('<body></body>');
global.window = document.defaultView;
global.navigator = window.navigator;
global.Promise = window.Promise;
global.Event = window.Event;
global.fetch = () => {};

// Dummy Browser Apis
global.Notification = () => {close()  };
global.localStorage = {
  getItem(){},
  setItem(){}
};
