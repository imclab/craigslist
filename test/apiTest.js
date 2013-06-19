var api = require('..')
  , test = it;

describe('api', function() {
  describe('getList', function() {
    test('http://sfbay.craigslist.org/apa/', function(done) {
      // 'http://sfbay.craigslist.org/apa/index.rss'
      api.getList('http://sfbay.craigslist.org/apa', function(error, data) {
        console.log(data)
        done();
      });
    });
  });
});
