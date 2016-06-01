# [OctoShelf](http://theirondeveloper.com/octoshelf/) - A Multi-Repo PR Manager

Ever find yourself tabbing between multiple repos across several orgs,
trying to manage the constant flow of new pull requests?

Cool, me too! OctoShelf was built to solve this exact issue!

In a nut-shell, OctoShelf can be seen as a multi-repo PR manager. It displays
open pull requests, and can be refreshed as often as you like.

## Usage

To use OctoShelf you can either go [here](http://theirondeveloper.com/octoshelf/),
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

And the webpage should be available on localhost:3000/

If you want to customize OctoShelf (for Corp Github Accounts) you can change
the following variables inside config.json:

```json
{
  "accessToken",    // You're generally going to want to leave this empty
  "apiUrl",         // Api Urls, which can look super different in enterprise
  "githubUrl"       // Github Url, the beginning part of the urls you visit. 
}
```

## Contributing

I welcome any and all forms of contributions. If you have a feature request, feel
free to open a new issue, or better yet, open a new pull request yourself! :)

## TODO

- [ ] Persist repositories that have been added.
- [ ] Add a refresh interval
- [ ] Add ability to remove nodes
- [ ] Access_Token on server side
- [ ] Allow nodes to grow and expand given enough screen size

## Potential Future Features

- [ ] Server-side pages that persists saved repos
- [ ] Progressive Web App?