# [OctoShelf](http://www.octoshelf.com/) - A Multi-Repo PR Manager

Ever find yourself tabbing between multiple repos across several orgs,
trying to manage the constant flow of new pull requests?

Cool, me too! OctoShelf was built to solve this exact issue!

In a nut-shell, OctoShelf can be seen as a multi-repo PR manager. It displays
open pull requests, and can be refreshed as often as you like.

## Usage

To use OctoShelf you can either go [here](http://www.octoshelf.com/),
or you can fork and hack this project to meet your own use cases.

## Features

With OctoShelf you can...

* Review the open pull requests of many repos at once
* Add / Remove Repositories
* Check for new pull requests
* Point API calls to an enterprise account

## Running the App

Running the app locally is simple:

```
npm install
npm start
```

And the webpage should be available on localhost:5000/

If you want to customize OctoShelf (for Corp Github Accounts) you can change
the following variables inside `config/githubApi.json`:

```javascript
{
  "accessToken": "",    // You'll probably want this to be empty, but useful if you're using a personal access token
  "githubAuthUrl": "",  // Populate the github authentication url
  "githubTokenUrl": "", // Once youn finish authenticating with github, we'll hit this url to grab an access token
  "apiUrl": "",         // Github's API url. It may look a little different for enterprise hosts
  "githubUrl": ""       // When you add a repo, we will replace this part with `apiUrl`
}
```

You'll notice you have limited capabilities, and may hit Github's ratelimit rather quickly.
To "fix" this, you have two options:

* [Generate a public access token](https://github.com/settings/tokens/new), and fill the `accessToken` property in `githubApi.json`\
* [Register a new OAuth Token](https://github.com/settings/applications/new), and run the following:

```
GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=xxx npm start
```

For more information, check out: https://developer.github.com/v3/oauth/

## Contributing

I welcome any and all forms of contributions. If you have a feature request, feel
free to open a new issue, or better yet, open a new pull request yourself! :)

## TODO

- [ ] Persist repositories that have been added.
- [ ] Add a refresh interval
- [ ] Allow nodes to grow and expand given enough screen size

## Potential Future Features

- [ ] Server-side pages that persists saved repos
- [ ] Progressive Web App?