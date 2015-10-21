var async = require('async');

function testLoop() {
    function work(i, cb) {
        console.log(i);
        cb();
    }

    function loop(i, onDone) {
        if (i>=10) {
            onDone();
        } else {
            work(i, function() {
                loop(i+1, onDone);
            });
        }
    }

    loop(0, function() {
        console.log('finished');
    });

    function loop(begin, end, task) {
        var i = begin;
        task(i, function cb() {
            if (++i <= end) {
                process.nextTick(function() {
                    task(i, cb);
                });
           }
        });
    }

    loop(0,10, work);
}

function dummy() {
    http.createServer(function (req, res) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        var html = "<h1>Demo page</h1>";
        async.waterfall([
            function(cb) {
                getSomeDate(client, function(someData) {
                    var d = '<p>' + someData + '</p>';
                    cb(d);
                });
            },

            function(d, cb) {
                getSomeOtherDate(client, function(someOtherData) {
                    d += '<p>' + someOtherData + '</p>';
                    cb(d);
                });
            },

            function(d, cb) {
                getMoreData(client, function(moreData) {
                    d += '<p>' + moreData + '</p>';
                    cb(d);
                });
            },
        ], function(d) {
            html += d;
            res.write(html);
            res.end();
        });
    });
}

function testError() {
    function log(msg) { console.log(msg); }
    async.waterfall([
        function(cb) {
            cb(null, 0);
        },

        function(i, cb) {
            log(i);
            cb(true);
            return cb(null, i+1);
        },


        function(i, cb) {
            log(i);
            cb(null, i+1);
        },

    ], function(err, result) {
        log('enter final');
        if (err) {
            log('final error');
            return;
        }
        log(result);
        log('end');
    });
}

testError();
