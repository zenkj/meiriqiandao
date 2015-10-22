var express = require('express');
var router = express.Router();
var hash = require('./hash');
var log = require('./log');
var mysql = require('mysql');
var async = require('async');

var dbpool = mysql.createPool({
    connectionLimit: 10,
    host: '127.0.0.1',
    user: 'mrqd',
    password: 'mrqd123',
    database: 'mrqd',
});

var DEFAULT_UID = -1;
var DEFAULT_UNAME = '签到君';
var MAX_ACTIVE_HABITS = 5;

/* GET home page. */
router.get('/', function(req, res, next) {
    var data = {
        title: '每日签到 - 养成好习惯',
        date: new Date(),
        user: {
            id: DEFAULT_UID,
            name: DEFAULT_UNAME,
        },
    };

    var uid = -1;
    if (typeof req.session.userid == 'undefined') {
        req.session.userid = DEFAULT_UID;
    } else {
        uid = +req.session.userid;
    }

    dbpool.query('select * from users where id = ?', [uid], function(err, rows, fields) {
        if (err) {
            log.log('error: code: ' + err.code + ', stack: ' + err.stack);
            res.json({error: true, msg: 'internal error'});
            return;
        }
        if (rows.length == 0) {
            log.log('this session is wrong, the user id ' + uid + ' does not exist');
            req.session.destroy();
        } else {
            data.user.id = uid;
            data.user.name = rows[0].name;
            req.session.username = rows[0].name;
            req.session.phone = rows[0].phone;
            req.session.email = rows[0].email;
        }
        res.render('index', data);
    });
});

// @params: none 
// @success return: {userid: -1, username: '签到君'}
router.post('/logout', function(req, res) {
    req.session.destroy(function(err) {
        res.json({userid: DEFAULT_UID, username: DEFAULT_UNAME, phone:'', email:''});
    });
});

// @params: {user: 12345678901, password: 123} 
// @success return: {userid: 13, username: 'abc'}
// @error return: {error: true, msg: '...'}
router.post('/login', function(req, res) {
    log.log('receive login');
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

    async.waterfall([
        function(cb) {
            dbpool.query(sql, [user], function(err, rows) {
                if (err) {
                    log.log('error: ' + err.message);
                    res.json({error: true});
                    return cb(err);
                }

                if (rows.length == 0) {
                    res.json({error: true});
                    return cb('err');
                }

                if (rows[0].password == hash.hash(password)) {
                    log.log('user ' + rows[0].name + '('+ rows[0].id + ') logined');
                    req.session.regenerate(function(err) {
                        cb(null, {userid: rows[0].id, username: rows[0].name, phone: rows[0].phone||'', email: rows[0].email||''});
                    });
                } else {
                    cb('err');
                }
            });
        },

        function(data, cb) {
            dbpool.query('select flag%2 as enabled, count(*) as count from habits where uid = ? group by enabled',
                [data.userid], function(err, result) {
                    if (err) {
                        log.log('error: ' + err);
                        req.session.destroy();
                        return cb(err);
                    }

                    for (var i=0; i<result.length; i++) {
                        if (result[i].enabled == 0)
                            data.inactiveHabitCount = result[i].count;
                        else if (result[i].enabled == 1)
                            data.activeHabitCount = result[i].count;
                    }
                    cb(null, data);
                });
        },

    ], function(err, result) {
        if (err) return ierr(res, '登录失败');
        req.session.userid = data.userid;
        req.session.username = data.username;
        req.session.phone = data.phone;
        req.session.email = data.email;
        req.session.activeHabitCount = data.activeHabitCount;
        req.session.inactiveHabitCount = data.inactiveHabitCount;
        req.session.cookie.maxAge = 10*24*60*60*1000;
        res.json(result);
    });
});


// @params: {phone: 12345678901, email: 'a@b.c', password: 123, name: 'ab'} 
// @success return: {uid: 13}
// @error return: {error: true, msg: '...'}
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

    async.waterfall([
        function(cb) {
            dbpool.getConnection(function(err, conn) {
                if (err) {
                    log.log('get connection failed: ' + err);
                    ierr(res);
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.beginTransaction(function(err) {
                if (err) {
                    log.log('begin transition failed: ' + err);
                    conn.release();
                    ierr(res);
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('insert into users(email, phone, password, name) values(?,?,?,?)', [email, phone, password, name], function(err, rows) {
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
                    conn.rollback(function() {
                        conn.release();
                    });
                    log.log('error: ' + err.message);
                    res.json({error: true, data: data, msg: msg});
                    return cb(err);
                }
                var userid = rows.insertId;
                cb(null, conn, userid);
            });
        },


        function(conn, userid, cb) {
            conn.query('insert into versions values(?,?)', [userid, 0], function(err, rows) {
                if (err) {
                    conn.rollback(function() {
                        conn.release();
                    });
                    log.log('error: ' + err.message);
                    ierr(res);
                    return cb(err);
                }
                cb(null, conn, userid);
            });
        },


        function(conn, userid, cb) {
            conn.commit(function(err) {
                if (err) {
                    conn.rollback(function() {
                        conn.release();
                    });
                    log.log('error: ' + err.message);
                    ierr(res);
                    return cb(err);
                }
                conn.release();
                log.log('signup success for user ' + userid);
                res.json({uid: userid});
                cb(null);
            });
        },
    ]);
});

// @params: {version: 13, name: 'ab', phone: 12345678901, email: 'a@b.c'} 
// @success return: {uid: 18, version: 14}
// @error return: {error: true, data:'phone', msg: '...'}
router.post('/user-config', function(req, res) {
    var uid = req.session.userid;
    if (!uid || uid == DEFAULT_UID) {
        res.json({error: true, msg: '尚未登录，请登录后再修改配置'});
        return;
    }
    var version = +req.body.version;
    var name = req.body.name || '';
    var phone = req.body.phone || '';
    var email = req.body.email || '';

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

    if (name.length == 0) {
        res.json({error: true, data: 'name', msg: '名字不能为空'});
        return;
    }

    async.waterfall([
        function(cb) {
            dbpool.getConnection(function(err, conn) {
                if (err) {
                    log.log('get connection failed: ' + err);
                    ierr(res);
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('update users set name=?, phone=?, email=? where id=?', [name, phone, email, uid], function(err, rows) {
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
                    conn.rollback(function() {
                        conn.release();
                    });
                    log.log('error: ' + err.message);
                    res.json({error: true, data: data, msg: msg});
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('update versions set version = version+1 where uid=?', [uid], function(err, rows) {
                if (err) {
                    conn.rollback(function() {
                        conn.release();
                    });
                    log.log('error: ' + err.message);
                    ierr(res);
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.commit(function(err) {
                if (err) {
                    conn.rollback(function() {
                        conn.release();
                    });
                    log.log('error: ' + err.message);
                    ierr(res);
                    return cb(err);
                }
                req.session.username = name;
                req.session.phone = phone;
                req.session.email = email;
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('select version from versions where uid = ?', [uid], function(err, result) {
                conn.release();
                if (err || result.length == 0) {
                    log.log('select version for uid ' + uid + ' failed.');
                    // use version + 2 to trigger client refresh
                    res.json({uid: uid, version: version+2});
                    return;
                }
                version = result[0].version;
                log.log('signup success for user ' + uid);
                res.json({uid: uid, version: version});
            });
        },
    ]);
});


function ierr(res, msg) {
    res.json({error: true, msg: msg||'Internal Server Error'});
}

// @params: {version: 12, name: 'abc', workday: 120} 
// @success return: {version: 13, habit: {id:12, name:'abc', workday: 120, enable: 1/0}}
// @error return: {error: true, msg: '...'}
router.post('/api/v1/habits', function(req, res) {
    var uid = req.session.userid;
    if (!uid || uid == DEFAULT_UID) {
        res.json({error: true, msg: '尚未登录，请登录后再创建习惯'});
        return;
    }
    var version = +req.body.version;
    var name = req.body.name;
    var workday = ((+req.body.workday) & 0xFE);

    var enable = 1;

    if (req.session.activeHabitCount >= MAX_ACTIVE_HABITS) {
        console.log('warning: new created habit is forced to be inactive');
        enable = 0;
    }

    var flag = enable | workday;;

    if (name.length == 0) {
        ierr(res, '名字不合法');
        return;
    }


    async.waterfall([
        function(cb) {
            dbpool.getConnection(function(err, conn) {
                if (err) {
                    log.log('get connection failed: ' + err);
                    ierr(res);
                    return cb(err); 
                }

                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.beginTransaction(function(err) {
                if (err) {
                    log.log('begin transition failed: ' + err);
                    conn.release();
                    ierr(res);  
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('insert into habits(uid,name,flag) values(?,?,?)',
                [uid, name, flag], function(err, result) {
                    if (err) {
                        var msg = '服务器内部错误，请联系管理员';
                        if (err.code == 'ER_DUP_ENTRY') {
                            msg = '该习惯已经存在，请使用其他名称创建';
                        }
                        log.log('error: ' + err.message);
                        conn.rollback(function() {
                            conn.release();
                        });
                        ierr(res, msg);
                        return cb(err);
                    }

                    var hid = result.insertId;

                    cb(null, conn, hid);
            });
        },


        function(conn, hid, cb) {
            conn.query('update versions set version = version + 1 where uid = ?',
                [uid], function(err, result) {
                    if (err) {
                        log.log('update version failed for uid ' + uid);
                        conn.rollback(function() {conn.release();});
                        ierr(res);
                        return cb(err);
                    }
                    cb(null, conn, hid);
            });
        },


        function(conn, hid, cb) {
            conn.commit(function(err) {
                if (err) {
                    log.log('commit transition faialed');
                    conn.rollback(function() {conn.release();});
                    ierr(res);
                    return cb(err);
                }

                if (enable) {
                    req.session.activeHabitCount ++;
                    req.session.activeHabits[hid] = true;
                } else {
                    req.session.inactiveHabitCount ++;
                }

                cb(null, conn, hid);
            });
        },


        function (conn, hid, cb) {
            conn.query('select version from versions where uid = ?',
                [uid], function(err, result) {

                conn.release();

                if (err || result.length == 0) {
                    log.log('select version for uid ' + uid + ' failed.');
                    // use version + 2 to trigger client refresh
                    version += 2;
                } else {
                    version = result[0].version;
                }
                res.json({version: version,
                        habit: {
                            id: hid,
                            name: name,
                            workday: workday,
                            enable: enable,
                            checkins:{}
                        }});
                cb();
            });
        },
    ]);
});

// @params: {version: 12, name: 'abc', workday: 120, enable: 1/0} 
// @success return: {version: 13}
// @error return: {error: true, msg: '...'}
router.put('/api/v1/habits/:hid', function(req, res) {
    var uid = req.session.userid;
    if (!uid || uid == DEFAULT_UID) {
        return ierr(res, '尚未登录，请登录后再修改习惯');
    }

    var hid, version, name, workday, enable, changeEnable;

    if (typeof req.params.hid == 'undefined' || +req.params.hid <= 0) {
        log.log('hid invalid: ' + req.params.hid);
        return ierr(res, '输入错误');
    }

    hid = +req.params.hid;

    if (typeof req.body.version == 'undefined') {
        log.log('version is not specified');
        return ierr(res, '输入错误');
    }

    version = +req.body.version;

    var sets = [];
    var vals = [];

    if (typeof req.body.name == 'string') {
        name = req.body.name;
        if (name.length == 0) {
            log.log('error: 名字不合法');
            return ierr(res, '名字不合法');
        }

        sets.push('name = ?');
        vals.push(name);
    }

    if (typeof req.body.workday != 'undefined') {
        workday = ((+req.body.workday) & 0xFE);
        sets.push('flag = (flag & (~0xFE)) | ?');
        vals.push(workday);
    }

    if (typeof req.body.enable != 'undefined') {
        enable = ((+req.body.enable) & 1);
        changeEnable = false;
        if (enable && !req.session.activeHabits[hid]) {
            if (req.session.activeHabitCount >= MAX_ACTIVE_HABITS) {
                log.log("error: can't enable more than 5 habits");
                return ierr(res, '最多只能有5个激活的习惯');
            }
            changeEnable = true;
        }
        if (!enable && req.session.activeHabits[hid]) {
            changeEnable = true;
        }

        if (changeEnable) {
            sets.push('flag = (flag & (~1)) | ?');
            vals.push(enable);
        }
    }

    if (sets.length == 0) {
        log.log('error: at least one of name/workday/enable should specified.');
        return ierr(res, '输入错误');
    }

    var sql = 'update habits set ' + sets.join(', ') + ' where id = ?';

    vals.push(hid);

    async.waterfall([
        function(cb) {
            dbpool.getConnection(function(err, conn) {
                if (err) {
                    log.log('get connection failed: ' + err);
                    ierr(res);
                    return cb(err); 
                }

                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.beginTransaction(function(err) {
                if (err) {
                    log.log('begin transition failed: ' + err);
                    conn.release();
                    ierr(res);  
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query(sql, vals, function(err, result) {
                if (err) {
                    var msg = '服务器内部错误，请联系管理员';
                    if (err.code == 'ER_DUP_ENTRY') {
                        msg = '该习惯已经存在，请改为其他名称';
                    }
                    log.log('error: ' + err.message);
                    conn.rollback(function() { conn.release(); });
                    ierr(res, msg);
                    return cb(err);
                }

                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('update versions set version = version + 1 where uid = ?',
                [uid], function(err, result) {
                    if (err) {
                        log.log('update version failed for uid ' + uid);
                        conn.rollback(function() {conn.release();});
                        ierr(res);
                        return cb(err);
                    }
                    cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.commit(function(err) {
                if (err) {
                    log.log('commit transition faialed');
                    conn.rollback(function() {conn.release();});
                    ierr(res);
                    return cb(err);
                }
                if (changeEnable && enable) {
                    req.session.activeHabitCount ++;
                    req.session.inactiveHabitCount --;
                    req.session.activeHabits[hid] = true;
                }
                if (changeEnable && !enable) {
                    req.session.activeHabitCount --;
                    req.session.inactiveHabitCount ++;
                    req.session.activeHabits[hid] = false;
                }
                cb(null, conn);
            });
        },


        function (conn, cb) {
            conn.query('select version from versions where uid = ?',
                [uid], function(err, result) {

                conn.release();

                if (err || result.length == 0) {
                    log.log('select version for uid ' + uid + ' failed.');
                    // use version + 2 to trigger client refresh
                    res.json({version: version+2});
                    return cb();
                }
                version = result[0].version;
                res.json({version: version});
                cb();
            });
        },
    ]);
});

// @params: {version: 12, name: 'abc', workday: 120, enable: 1/0} 
// @success return: {version: 13}
// @error return: {error: true, msg: '...'}
router.get('/api/v1/habits', function(req, res) {
});

// do not support now
// {version: 12}
router.delete('/api/v1/habits/:hid', function(req, res) {
  var data = {
    version: 13,
  };
  res.json(data);
});


// @param: {version: 12, checkin: 1/0}
// @success return: {version: 13}
// @error return: {error: true, msg: 'xxx'}
router.put('/api/v1/checkins/:hid_yyyy_mm_dd', function(req, res) {
    var uid = req.session.userid;

    if (!uid) {
        log.log('error: checkin before login....');
        ierr(res, '尚未登录，请登录后再签到');
        return;
    }

    var chid = req.params.hid_yyyy_mm_dd || '';
    var version = req.body.version;
    var checkin = req.body.checkin;
    var r = chid.replace('-', ' ').match(/\S+/g);
    var hid, date;
    if (r && r.length == 2) {
        hid = +r[0];
        date = new Date(r[1]);
    } else {
        log.log('error: invalid checkin id: ' + chid);
        ierr(res, '请求url出错');
        return;
    }

    if (typeof version == 'undefined') {
        log.log('error: parameter error, version = ' + version);
        ierr(res, '请求参数出错');
        return;
    }

    checkin = !!+checkin;

    version = +version;

    async.waterfall([
        function(cb) {
            dbpool.getConnection(function(err, conn) {
                if (err) {
                    log.log('get connection failed: ' + err);
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.beginTransaction(function(err) {
                if (err) {
                    log.log('begin transition failed: ' + err);
                    conn.release();
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var d = date.getDate() - 1;

            var field = 'm' + m;
            var sql = 'insert into checkins(hid, year, uid, '+field+') values(' +hid+','+y+','+uid+','+(1<<d)+') '+
                      'on duplicate key update '+field+'='+field+'|(1<<'+d+')';
            if (!checkin) {
                sql = 'insert into checkins(hid, year, uid, '+field+') values('+hid+','+y+','+uid+',0) '+
                      'on duplicate key update '+field+'='+field+'&(~(1<<'+d+'))';
            }

            //log.log('sql: ' + sql);
            conn.query(sql, function(err, result) {
                if (err) {
                    log.log('update checkin failed: ' + sql);
                    conn.rollback(function() { conn.release(); });
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('update versions set version = version+1 where uid=?', [uid], function(err, result) {
                if (err) {
                    log.log('update version for uid '+uid+ ' failed');
                    conn.rollback(function() {conn.release();});
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.commit(function(err) {
                if (err) {
                    log.log('commit transition faialed');
                    conn.rollback(function() {conn.release();});
                    return cb(err);
                }
                cb(null, conn);
            });
        },


        function(conn, cb) {
            conn.query('select version from versions where uid=?', [uid], function(err, result) {
                conn.release();
                if (err || result.length == 0) {
                    log.log('select version for uid ' + uid + ' failed.');
                    // when error occurs, use version + 2 to trigger client refresh
                    version += 2;
                } else {
                    version = result[0].version;
                }
                cb();
            });
        },

    ], function(err){
        if (err) return ierr(res);
        res.json({version: version});
    });

});

router.get('/api/v1/checkins', function(req, res) {
    var uid = req.session.userid || DEFAULT_UID;
    var data = {
        uid: uid,
        habits: [],
    };
    var habits = {};

    var finalcb = function (err, result) {
        if (err) return ierr(res);
        res.json(data);
    }

    async.waterfall([
        function(cb) {
            dbpool.query('select version from versions where uid = ?', [uid], function(err, rows) {
                if (err) {
                    log.log('error: ' + err);
                    return cb(err);
                }
                if (rows.length == 0) {
                    log.log('error: no version specified for ' + uid);
                    return cb(err);
                }
                data.version = +rows[0].version;
                cb();
            });
        },

        function(cb) {
            dbpool.query('select * from habits where flag%2 = 1 && uid = ?', [uid], function(err, rows) {
                if (err) {
                    log.log('error: ' + err);
                    return cb(err);
                }

                //log.log('got ' + rows.length + ' habits for user ' + uid);

                if (rows.length == 0) {
                    return finalcb();
                }

                req.session.activeHabits = {};

                for (var i=0; i<rows.length; i++) {
                    var id = rows[i].id;
                    var name = rows[i].name;
                    var flag = rows[i].flag;
                    var workday = (flag & 0xFE);
                    habits[id] = {
                        id: id,
                        name: name,
                        workday: workday,
                        checkins: {},
                    };
                    req.session.activeHabits[id] = true;
                }

                cb();
            });
        },

        function(cb) {
            dbpool.query('select * from checkins where uid = ?', [uid], function(err, rows) {
                var i, h;
                if (err) {
                    log.log('error: ' + err);
                    return cb(err);
                }
                //log.log('got ' + rows.length + ' checkins for user ' + uid);
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

                for (h in habits) {
                    data.habits.push(habits[h]);
                }
                cb();
            });
        },
    
    ], finalcb);

});

router.get('/api/v1/whoami', function(req, res) {
    var data = {
        id: req.session.userid || -1,
        name: req.session.username || '签到君',
        phone: req.session.phone || '',
        email: req.session.email || '',
        activeHabitCount: 0,
        inactiveHabitCount: 0,
    };

    dbpool.query('select flag%2 as enabled, count(*) as count from habits where uid = ? group by enabled',
        [data.id], function(err, result) {
            if (err) {
                log.log('error: ' + err);
                return ierr(res, '查询出错');
            }

            for (var i=0; i<result.length; i++) {
                if (result[i].enabled == 0)
                    data.inactiveHabitCount = result[i].count;
                else if (result[i].enabled == 1)
                    data.activeHabitCount = result[i].count;
            }

            res.json(data);
        });
});

module.exports = router;
