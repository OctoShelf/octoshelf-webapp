# OctoShelf

Ever find yourself tabbing between multiple repos across several orgs,
trying to manage the constant flow of new pull requests?

Cool, me too! OctoShelf was built to solve this exact issue!

## [Live Demo Here](http://theirondeveloper.com/octoshelf/)

## Usage

To use OctoShelf you can either go [here](http://theirondeveloper.com/octoshelf/),
or you can fork and hack this project to meet your own use cases.

* All the github api calls are done on the client side.
* If you want to do more than 60 github api calls in a minute, you'll need to authenticate on github.
    * The oAuth link will take you to github, then redirect back (Not done yet).
* A history of the repositories you added will live on your browser session (with localStorage). (Not done yet)

## Running the App

Right now, the app is just vanilla html/js. So you can fork this and simply open up `index.html`.
In the near future I will be tossing this into a server instance to handle grabbing the `access_token`
from Github's oAuth redirection.


## Running the App Future Plan

My plan (open to feedback) is that you can run:

```
CLIENT_ID=_ CLIENT_SECRET=_ npm start
```

That way, the github client + secret are not exposed in the code.
(just... your bash history...  .... ... ... :|)

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