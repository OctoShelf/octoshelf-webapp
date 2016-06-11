
var path = require('path');
var webpack = require('webpack');

var plugins = [
  new webpack.ProvidePlugin({
    Promise: 'imports?this=>global!exports?global.Promise!es6-promise',
    fetch: 'imports?this=>global!exports?global.fetch!whatwg-fetch'
  })
];

module.exports = {
  context: path.resolve('public/'),
  entry: {
    app: './entry/app.js'
  },
  output: {
    // Because worker-loader only saves to relative path, I have to use the root directory to serve our bundle
    path: path.resolve('./public/'),
    filename: '[name].js'
  },

  plugins: plugins,

  module: {
    loaders: [
      { test: /\.js?$/, exclude: /(node_modules|bower_components)/, loader: 'babel' },
      { test: /\.json$/, loader: 'json' },
      { test: /\.worker\.js?$/, loader: 'worker!babel' }
    ]
  }

};