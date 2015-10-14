var express = require('express');
var router = express.Router();

var mysql = require('mysql');

var dbpool = mysql.createPool({
    connectionLimit: 10,
    host: '127.0.0.1',
    user: 'mrqd',
    password: 'mrqd123',
    database: 'mrqd',
});

/* GET home page. */
router.get('/', function(req, res, next) {
    var data = {
        title: '每日签到 - 养成好习惯',
        date: new Date(),
        user: {
            id: -1,
            name: '签到君',
        },
    };

    var uid = -1;
    if (typeof req.session.uid == 'undefined') {
        req.session.uid = -1;
    } else {
        uid = +req.session.uid;
    }

    dbpool.query('select * from users where id = ?', [uid], function(err, rows, fields) {
        if (err) throw err;
        if (rows.length == 0) {
            console.log('this session is wrong, the user id ' + uid + ' does not exist');
            req.session = null;
        } else {
            data.user.id = uid;
            data.user.name = rows[0].name;
        }
        res.render('index', data);
    });
});

router.get('/logout', function(req, res) {
});

router.post('/login', function(req, res) {
});

router.post('/signup', function(req, res) {
});

router.put('/user-config', function(req, res) {
});


// error message
// {error: true, msg: 'error reason'}

// {version: 12, name: 'abc', workday: [1,2,3,4,5]} 
router.post('/api/v1/habits', function(req, res) {
  var data = {
    version: 13,
    habits: [
      {
        id: 1,
        name: 'abc',
        workday: [1,2,3,4,5],
      },
    ],
  };
  res.json(data);
});

// {version: 12, name: 'abc', workday: [1,2,3,4,5], enable: false}
router.put('/api/v1/habits/:hid', function(req, res) {
  var data = {
    version: 13,
    habits: [
      {
        id: 1,
        name: 'abc',
        workday: [1,2,3,4,5],
      },
    ],
  };
  res.json(data);
});

// do not support now
// {version: 12}
router.delete('/api/v1/habits/:hid', function(req, res) {
  var data = {
    version: 13,
  };
  res.json(data);
});


// {version: 12, checkin: true/false}
router.put('/api/v1/checkins/:hid_yyyy_mm_dd', function(req, res) {
  var data = {
    version: 13,
  };
  res.json(data);
});

router.get('/api/v1/checkins', function(req, res) {
    console.log('get /api/v1/checkins: ' + req.path);
  var data = {
    uid: 0,
    version: 12,
    habits: [
      {
        id: 1,
        name: '每天跑步5公里',
        workday: [1,2,3,4,5,6],
        checkins: {
          '2014': [1,1,1,1,8,1,1,1,1,1,1,1],
          '2015': [1,1,19,0,1,1,1,1,0,0,1,1],
          '2016': [0,0,0,0,0,0,0,0,0,0,0,0],
        },
      },
      {
        id: 2,
        name: '每天11:30前睡觉',
        workday: [1,2,3,4,5,6,7],
        checkins: {
          '2014': [1,1,1,1,8,1,1,1,1,1,1,1],
          '2015': [1,1,1,85,1,1,43,1,0,0,1,1],
          '2016': [0,0,0,0,0,0,0,0,0,0,0,0],
        },
      },
      {
        id: 3,
        name: '每天阅读半小时',
        workday: [1,2,3,4,5,7],
        checkins: {
          '2014': [1,1,1,1,8,1,1,1,1,1,1,1],
          '2015': [1,1,1,85,1,1,43,1,0,0,1,1],
          '2016': [0,0,0,0,0,0,0,0,0,0,0,0],
        },
      },
      {
        id: 6,
        name: '每周六陪父母聊天',
        workday: [6],
        checkins: {
          '2014': [1,1,1,1,1,1,1,1,1,1,1,1],
          '2015': [1,1,1,1,1,1,1,1,0,0,1,1],
          '2016': [0,0,0,0,0,0,0,0,0,0,0,0],
        },
      },
    ],
  };
  res.json(data);
});

router.get('/api/v1/whoami', function(req, res) {
    var data = {
        id: 0,
        name: '签到君',
        description: '签到小助手',
    };

    res.json(data);
});

module.exports = router;
