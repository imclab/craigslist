// http://josscrowcroft.github.com/open-exchange-rates/

var agent = require('superagent')
  , cheerio = require('cheerio')
  , moment = require('moment')
  , feedParser = require('feedparser')
  , _ = require('underscore');

cheerio.prototype.make = function(dom, context) {
  if(dom.cheerio) return dom;
  dom = (_.isArray(dom)) ? dom : [dom];
  context || (context = new cheerio())
  return _.extend(context, dom, { length : dom.length, find: context.find });
};

exports.headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11'
  , 'Cache-Control': 'no-cache'
  , 'Pragma': 'no-cache'
}

exports.patterns = {
  currency: /\$[+-]?[0-9]{1,3}(?:[0-9]*(?:[.,][0-9]{2})?|(?:,[0-9]{3})*(?:\.[0-9]{2})?|(?:\.[0-9]{3})*(?:,[0-9]{2})?)/
}

exports.get = function(url, callback) {
  agent.get(url).buffer(true).set(exports.headers).end(callback);
}

agent.parse['application/xml'] = agent.parse['text'];

// rss feed only updates every hour.
exports.getListRSS = function(url, callback) {
  url = url.replace(/\/$/, '');
  url = url + '/index.rss';

  var result = [];

  exports.get(url, function(response) {
    feedParser.parseString(response.text)
      .on('meta', function(meta) {

      })
      .on('article', function(article) {
        // 1 BD COTTAGE for Rent in CLAYTON (concord / pleasant hill / martinez) $1300 1bd 600sqft
        var title = article.title.split(/\) \$/);

        if (title.length < 2)
          return;

        var specs = title[1].split(' ')
          , price = '$' + specs[0]
          , bedrooms = specs[1]
          , footage = specs[2];

        title = title[0].split('(');

        var cities = title.pop().split(' / ');

        title = title.join('(').trim();

        article.cities = cities;
        article.price = price;
        article.bedrooms = bedrooms;
        article.footage = footage;

        result.push({
            title: title
          , description: article.description
          , publishedAt: article.pubDate
          , url: article.link
          , cities: cities
          , price: price
          , bedrooms: bedrooms
          , footage: footage
        });
      })
      .on('complete', function(feed) {
        if (callback) callback(null, result);
      });
  });
}

exports.getEachListing = function(listings, callback) {
  var i = -1, n = listings.length;

  function iterate() {
    i++;
    if (i < n) {
      exports.getListing(listings[i], iterate);
    } else {
      if (callback) callback(null, listings);
    }
  }

  iterate();
}

exports.getListHTML = function(url, params, callback) {
  if (typeof params == 'function') {
    callback = params;
    params = {};
  }

  exports.get(url, function(response) {
    var $ = cheerio.load(response.text)
      , result = []
      , item, date, previousDate;

    var didBreak = false;

    $('#toc_rows .row').each(function(index, element) {
      element = $(element)

      var link = element.find('a')
        , title = link.text().trim()
        , url = link.attr('href')
        , id;

      id = url.split('/');
      id = id[id.length - 1].replace(/.html$/i, '');

      if (didBreak || (params.postId && id === params.postId)) {
        didBreak = true;
        return false;
      }

      var item = {};

      // date
      date = element.find('.itemdate').text().trim();

      if (!date || date == '') {
        var prev = element.prev();
        if (prev && prev[0].name.match(/h/i) && prev.hasClass('ban')) {
          date = prev.text().trim()
        } else {
          date = previousDate;
        }
      }

      if (date && date != '') {
        item.publishedAt = moment(date).toDate();

        if (!previousDate) {
          previousDate = item.publishedAt;
        }
      }

      var offer = element.find('.itemph').text().trim().replace(/ +-$/, '')
        , offerArray = offer.split(/ *[-\/] */g)
        , price = offerArray[0]
        , bedrooms = offerArray[1]
        , footage = offerArray[2]
        , hasPic = !!element.find('.itempx').text().trim().match('pic');

      item.postId = id;
      item.title = title;
      item.url = url;
      //item.offer = offer;
      item.price = price;
      if (bedrooms) item.bedrooms = bedrooms;
      if (footage) item.footage = footage;
      item.hasPic = hasPic;

      result.push(item);
    });

    if (callback) callback(null, result);
  });
}

exports.getListing = function(url, callback) {
  var listing;

  if (typeof url == 'object') {
    listing = url;
    url = listing.url;
  } else {
    listing = {url: url};
  }

  exports.get(url, function(response) {
    var $ = cheerio.load(response.text);

    var emailLink = $('#replytext').next().find('a')
      , email = emailLink.text().trim()
      , emailUrl = emailLink.attr('href')
      , date = $('.postingdate').text().trim().replace(/^Date: +/, '').replace(/,\s+/, ' ');

    // Date: 2012-11-15,  1:12AM PST
    // Date: 2012-11-09, 10:19PM PST
    listing.publishedAt = moment(date, 'YYYY-MM-DD hh:mmA Z').toDate();

    function extractCoordinates() {    
      var coordinates = $('#leaflet')
        , lat = coordinates.attr('data-latitude')
        , lng = coordinates.attr('data-longitude');

      if (lat && lng && parseFloat(lat) != 0) {
        listing.coordinates = {lat: lat, lng: lng};
      }
    }

    function extractImages() {
      var coverImage = $('#iwi').attr('src');

      if (coverImage) {
        var images = [];

        $('#iwt .tn a').each(function(i, node) {
          node = $(node);

          images.push({url: node.attr('href'), thumbUrl: node.find('img').attr('src')});
        });

        listing.coverImage = coverImage;
        listing.images = images;
      }
    }

    function extractMaps(node) {
      node.find('a').each(function(i, link) {
        link = $(link);
        var text = link.text().trim()
          , url = link.attr('href');
        if (text.match('google')) {
          listing.googleMap = url;
        } else if (text.match('yahoo')) {
          listing.yahooMap = url;
        }
      });
    }

    function extractBlurbs(node) {
      node.find('li').each(function(i, item) {
        var text = $(item).text();

        if (text.match('dogs are OK - wooof'))
          listing.dogsAllowed = true;
        if (text.match('cats are OK - purrr'))
          listing.catsAllowed = true;
      });
    }

    var node = $('#userbody > script'), nextNode;
    while (node) {
      if ((nextNode = node.next()) && (nextNode != node)) {
        if (nextNode.hasClass('iw'))
          extractImages();
        else if (nextNode[0].name == 'small')
          extractMaps(nextNode);
        else if (nextNode.hasClass('blurbs')) {
          extractBlurbs(nextNode);
        }
      } else {
        nextNode = null;
      }

      node.remove();
      node = nextNode;
    }

    var text = $('#userbody').text().trim().replace(/\n{2}\n+/, '\n\n');

    extractCoordinates();

    listing.email = email;
    listing.emailUrl = emailUrl;
    listing.text = text;

    if (callback) callback(null, listing);
  });
}

exports.getList = exports.getListHTML;