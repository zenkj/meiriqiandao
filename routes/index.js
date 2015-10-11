var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  var data = {
    title: '每日签到 - 养成好习惯',
    date: new Date(),
    user: {
        name: '签到君'
    },
  };
  res.render('index', data);
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
  var data = {
    version: 12,
    habits: [
      {
        id: 1,
        name: '每天跑步半小时',
        workday: [1,2,3,4,5,6],
        checkins: {
          '2014': [1,1,1,1,8,1,1,1,1,1,1,1],
          '2015': [1,1,1,0,1,1,1,1,0,0,1,1],
          '2016': [0,0,0,0,0,0,0,0,0,0,0,0],
        },
      },
      {
        id: 2,
        name: '每天11:30前睡觉',
        workday: [1,2,3,4,5,6,7],
        checkins: {
          '2014': [1,1,1,1,8,1,1,1,1,1,1,1],
          '2015': [1,1,1,0,1,1,1,1,0,0,1,1],
          '2016': [0,0,0,0,0,0,0,0,0,0,0,0],
        },
      },
    ],
  };
  res.json(data);
});

module.exports = router;
