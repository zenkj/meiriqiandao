var express = require('express');
var router = express.Router();
var hash = require('./hash');
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
        if (err) {
            console.log('error: code: ' + err.code + ', stack: ' + err.stack);
            res.json({error: true, msg: 'internal error'});
            return;
        }
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

router.post('/logout', function(req, res) {
});

router.post('/login', function(req, res) {
    console.log('receive login');
    var user = req.body.user || '';
    var password = req.body.password || '';
    var phone = (user.match(/\d+/g) || [])[0];
    var email = user.match(/^([\w.-]+)@(.*)(\.\w+)$/);
    if (user.length == 0 ||
        password.length == 0 ||
        ((phone != user || phone.length != 11) && !email)) {
        res.json({error:true});
        return;
    }

    var sql = 'select * from users where phone = ?';
    if (!phone)
        sql = 'select * from users where email = ?';
    
    dbpool.query(sql, [user], function(err, rows) {
        if (err) {
            console.log('error: ' + err.message);
            res.json({error: true});
            return;
        }

        if (rows.length == 0) {
            res.json({error: true});
            return;
        }

        if (rows[0].password == hash.hash(password)) {
            console.log('user ' + rows[0].name + '('+ rows[0].id + ') logined');
            req.session.regenerate(function(err) {
                req.session.userid = rows[0].id;
                req.session.username = rows[0].name;
                req.session.cookie.maxAge = 10*24*60*60*1000;
                res.json({userid: rows[0].id, username: rows[0].name});
            });
        } else {
            res.json({error: true});
        }
    });
});

router.post('/signup', function(req, res) {
    var phone = req.body.phone || '';
    var email = req.body.email || '';
    var password = req.body.password || '';
    var name = req.body.name || '';

    var phone1 = (phone.match(/\d+/g) || [])[0];
    if (phone1 != phone || !phone1 || phone1.length != 11) {
        res.json({error: true, data: 'phone', msg: '手机号格式错误，请输入11个阿拉伯数字'});
        return;
    }

    if (email.length > 0 && !email.match(/^([\w.-]+)@(.*)(\.\w+)$/)) {
        res.json({error: true, data: 'email', msg: '邮箱格式错误'});
        return;
    }

    email = email.length > 0 ? email : null;

    if (password.length < 6) {
        res.json({error: true, data: 'password', msg: '密码长度不足6个字符'});
        return;
    }

    if (name.length == 0) {
        res.json({error: true, data: 'name', msg: '名字不能为空'});
        return;
    }

    password = hash.hash(password);

    dbpool.query('insert into users(email, phone, password, name) values(?,?,?,?)', [email, phone, password, name], function(err, rows, fields) {
        if (err) {
            var data = 'name';
            var msg = '服务器内部错误，请联系管理员';
            if (err.code == 'ER_DUP_ENTRY') {
                if (err.message.indexOf("key 'email'") >= 0) {
                    data = 'email';
                    msg = '邮箱地址已经使用，请使用其他邮箱';
                } else {
                    data = 'phone';
                    msg = '手机号已经使用，请使用其他手机号';
                }
            }
            console.log('error: ' + err.message);
            res.json({error: true, data: data, msg: msg});
            return;
        }
        dbpool.query('select id from users where phone = ?', [phone], function(err, rows) {
            if (err || rows.length == 0) {
                console.log('select failed');
                ierr(res);
                return;
            }
            dbpool.query('insert into versions values(?,?)', [rows[0].id, 0]);
            res.json({uid: rows[0].id});
        });
    });
});

router.put('/user-config', function(req, res) {
});


// error message
// {error: true, msg: 'error reason'}

function ierr(res, msg) {
    res.json({error: true, msg: msg||'Internal Server Error'});
}

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
    var uid = req.session.userid || -1;
    var data = {
        uid: uid,
        habits: [],
    };
    var habits = {};

    dbpool.query('select version from versions where uid = ?', [uid], function(err, rows) {
        if (err) {
            console.log('error: ' + err);
            ierr(res);
            return;
        }
        if (rows.length == 0) {
            console.log('error:  no version for user ' + uid);
            ierr(res);
            return;
        }
        data.version = +rows[0].version;
        dbpool.query('select * from habits where flag%2 = 1 && uid = ?', [uid], function(err, rows) {
            if (err) {
                console.log('error: ' + err);
                ierr(res);
                return;
            }
            if (rows.length == 0) {
                res.json(data);
                return;
            }
            var ids = [];
            for (var i=0; i<rows.length; i++) {
                var id = rows[i].id;
                var name = rows[i].name;
                var flag = rows[i].flag;
                var workday = [];
                ids.push(id);
                for (var j=1; j<=7; j++) {
                    if ((flag>>j)&1) workday.push(j);
                }
                habits[id] = {
                    id: id,
                    name: name,
                    workday: workday,
                    checkins: {},
                };
            }

            dbpool.query('select * from checkins where hid in (' + ids.join(',') + ')', function(err, rows) {
                var i, h;
                if (err) {
                    console.log('error: ' + err);
                    ierr(res);
                    return;
                }
                for (i=0; i<rows.length; i++) {
                    h = habits[rows[i].hid];
                    h.checkins[rows[i].year] = [
                        rows[i].m1,
                        rows[i].m2,
                        rows[i].m3,
                        rows[i].m4,
                        rows[i].m5,
                        rows[i].m6,
                        rows[i].m7,
                        rows[i].m8,
                        rows[i].m9,
                        rows[i].m10,
                        rows[i].m11,
                        rows[i].m12,
                    ];
                }

                for (i=0; i<habits.length; i++) {
                    data.habits.push(habits[i]);
                }
                res.json(data);
            });
        });
    });
/*
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
*/
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
