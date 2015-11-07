
// performance test
var http = require('http');
var qs = require('querystring');



var data = qs.stringify({user: '18666292623', password: 'Huawei123'});
var loginOption = {
    hostname: 'wokeyi.org',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
};

var logoutOption = {
    hostname: 'wokeyi.org',
    port: 3000,
    path: '/logout',
    method: 'POST',
    headers: {
        'Cookie': 'connect.sid='+cookie,
    },
};

var count = 0;
var cookie = '';
var prevTime = 0;
var currTime = 0;

function log(msg, delta) {
    if (typeof msg == 'undefined') {
        console.log('');
    } else {
        prevTime = currTime;
        currTime = Date.now();
        var t = ''+currTime;
        if (delta) t += '(' + (currTime-prevTime) + ')';

        console.log(t+': ' + msg);
    }
}

function login() {
    log();
    log('login=============================== ' + (count++));
    http.request(loginOption, function(res) {
        log('status: ' + res.statusCode, true);
        cookie = (res.headers['set-cookie']||[''])[0].replace(/.*connect.sid=([^;]*);.*/, '$1');
        console.log('cookie: ' + cookie);
        res.on('data', function(chunk) {
            console.log('body: ' + chunk);
        });

        res.on('end', function() {
            console.log('no more data');
            logout();
        });
    }).on('error', function(err) {
        console.log('error on request');
    }).end(data);
}

function logout() {
    log('logout-------------------------------');
    http.request(loginOption, function(res) {
        log('status: ' + res.statusCode, true);
        cookie = (res.headers['set-cookie']||[''])[0].replace(/.*connect.sid=([^;]*);.*/, '$1');
        console.log('cookie: ' + cookie);
        res.on('data', function(chunk) {
            console.log('body: ' + chunk);
        });

        res.on('end', function() {
            console.log('no more data');
            login();
        });
    }).on('error', function(err) {
        console.log('error on request');
    }).end(data);
}

login();
