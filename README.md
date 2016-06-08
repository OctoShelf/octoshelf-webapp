# [OctoShelf](http://www.octoshelf.com/) - A Multi-Repo PR Manager

Ever find yourself tabbing between multiple repos across several orgs,
trying to manage the constant flow of new pull requests?

Cool, me too! OctoShelf was built to solve this exact issue!

In a nut-shell, OctoShelf can be seen as a multi-repo PR manager. It displays
open pull requests, and can be refreshed as often as you like.

OctoShelf is powered by:

* [LocalStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage),
* [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API),
* [Notifications](https://developer.mozilla.org/en-US/docs/Web/API/notification),
* and [Github's Awesome Api](https://developer.github.com/v3/)

## Usage

To use OctoShelf you can either go [here](http://www.octoshelf.com/),
or you can fork and hack this project to meet your own use cases.

## Features

With OctoShelf you can...

* Add / Remove Repositories (persisted with localstorage)
* Review the open pull requests of many repos at once
* Check for new pull requests (Managed by a background web worker)
* Receive notifications when tabbed away (using Notifications API)
* Point API calls to an enterprise account (see below)

## Running the App

Running the app locally is simple:

```
npm install
npm start
```

And the webpage will be available on localhost:5000/

If you want to customize OctoShelf update the following variables inside `config/config.json`:

```javascript
{
  "githubAuthUrl": "",  // Populate the github authentication url
  "githubTokenUrl": "", // Once youn finish authenticating with github, we'll hit this url to grab an access token
  "apiUrl": "",         // Github's API url. It may look a little different for enterprise hosts
  "githubUrl": ""       // When you add a repo, we will replace this part with `apiUrl`
}
```

You  may hit Github's api ratelimit rather quickly. To "fix" this, you have two options:

* [Generate a public access token](https://github.com/settings/tokens/new), and run the following:

```
PERSONAL_ACCESS_TOKEN=xxx npm start
```

* [Register a new OAuth Token](https://github.com/settings/applications/new), and run the following:

```
GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=xxx npm start
```

Personal access tokens and client_secret should be treated with the same level of security as a password.
For more information, check out: https://developer.github.com/v3/oauth/

## Contributing

I welcome any and all forms of contributions. If you have a feature request, feel
free to open a new issue, or better yet, open a new pull request yourself! :)
