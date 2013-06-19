# Fetch Craigslist Listings in Node.js

Given that places in the Bay Area fill up so quickly, I made this to notify me whenever anything new was posted for a search I previously made on Craigslist. This was also an experiment integrating with Twilio (https://gist.github.com/4077346).

> Note: Craigslist doesn't provide an API, and they don't want commerical apps accessing their site in an "API-like way" unless you ask their permission manually. So this lib should only be used for personal fun.

## Install

```
npm install craigslist
```

## Usage

``` javascript
var craigslist = require('craigslist');

// this parses the HTML list, which doesn't include things like images and geo coordinates
craigslist.getList('http://auburn.craigslist.org/apa/', function(error, listings) {
  listings.forEach(function(listing) {
    listing.title;
    listing.description;
    listing.url;
    listing.cities;
    // ...
  });

  // for each listing, you can fetch the details (from actual listing html page on craigslist)
  craigslist.getListing(listing[0], function(error, listing) {
    listing.publishedAt;
    listing.coverImage;
    listing.images;
    listing.coordinates;
    listing.dogsAllowed;
    listing.catsAllowed;
    // .. see source
  });
});
```
