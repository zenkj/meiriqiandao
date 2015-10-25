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

/* utilities  begin */
function isValidPhone(phone) {
    if (typeof phone != 'string') return false;
    var phone = (phone.match(/\d+/g) || [])[0];
    if (phone && phone.length == 11)
        return true;
    return false;
}

function isValidEmail(email) {
    if (typeof phone != 'string') return false;
    var email = email.match(/^([\w.-]+)@(.*)(\.\w+)$/);
    if (email) return true;
    return false;
}

function ierr(res, msg) {
    res.json({error: true, msg: msg||'Internal Server Error'});
}
/* utilities  end   */

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
    var user = req.body.user || '';
    var password = req.body.password || '';
    var phone = isValidPhone(user) ? user : null;
    var email = isValidEmail(user) ? user : null;
    if (password.length == 0 || (!phone && !email)) {
        res.json({error:true});
        return;
    }

    var sql = 'select u.*, v.version from users u, versions v where u.phone = ?';
    if (!phone)
        sql = 'select u.*, v.version from users u, versions v where u.email = ?';

    async.waterfall([
        function(cb) {
            dbpool.query(sql, [user], function(err, rows) {
                if (err) {
                    log.log('error: ' + err.message);
                    return cb(err);
                }

                if (rows.length == 0) {
                    return cb('err');
                }

                if (rows[0].password == hash.hash(password)) {
                    log.log('user ' + rows[0].name + '('+ rows[0].id + ') logined');
                    req.session.regenerate(function(err) {
                        cb(null, {userid: rows[0].id, username: rows[0].name, phone: rows[0].phone||'', email: rows[0].email||'', version: version});
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

        function (data, cb) {
            dbpool.query('select id from habits where flag%2=1 and uid=?', [data.userid], function(err, result) {
                if (err) {
                    log.log('error: ' + err);
                    req.session.destroy();
                    return cb(err);
                }

                data.activeHabits = {};
                for (var i=0; i<result.length; i++) {
                    data.activeHabits[result[i].id] = true;
                }

                cb(null, data);
            });
        },

    ], function(err, data) {
        if (err) return ierr(res, '登录失败');
        req.session.userid = data.userid;
        req.session.username = data.username;
        req.session.phone = data.phone;
        req.session.email = data.email;
        req.session.activeHabitCount = data.activeHabitCount;
        req.session.inactiveHabitCount = data.inactiveHabitCount;
        req.session.activeHabits = data.activeHabits;
        //req.session.version = data.version;
        req.session.cookie.maxAge = 10*24*60*60*1000;
        res.json({userid: data.userid,
                  username: data.username,
                  phone: data.phone,
                  email: data.email});
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

    if (!isValidPhone(phone)) {
        res.json({error: true, data: 'phone', msg: '手机号格式错误，请输入11个阿拉伯数字'});
        return;
    }

    if (email.length > 0 && !isValidEmail(email)) {
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

    if (!isValidPhone(phone)) {
        res.json({error: true, data: 'phone', msg: '手机号格式错误，请输入11个阿拉伯数字'});
        return;
    }

    if (email.length > 0 && !isValidEmail(email)) {
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
            sets.push('flag = (flag & 0xFE) | ?');
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

                if (err || result.length == 0) {
                    log.log('select version for uid ' + uid + ' failed.');
                    // use version + 2 to trigger client refresh
                    version = version+2;
                }
                else version = result[0].version;

                conn.release();

                cb(null, {version: version});
            });
        },

    ], function finalcb(err, result){
        if (!err) {
            res.json(result);
        }
    });
});

// @params: none
// @success return: {version: 13, uid: 14, habits: []}
// @error return: {error: true, msg: '...'}
router.get('/api/v1/habits', function(req, res) {
    var habits = [];
    var habitMap = {};
    var activeHabits = {};
    var activeHabitCount = 0;
    var inactiveHabitCount = 0;
    var checkins = [];
    var version = 0;
    var uid = +req.session.userid || DEFAULT_UID; // userid will never be 0

    async.parallel([
        function(cb) {
            dbpool.query('select * from habits where uid = ? order by id desc', [uid], function(err, result) {
                if (err) {
                    log.log('query habits failed for uid ' + uid + ': ' + err);
                    return cb(err);
                }

                for (var i=0; i<result.length; i++) {
                    var h = {
                        id: result[i].id,
                        name: result[i].name,
                        workday: result[i].flag & 0xFE,
                        enable: result[i].flag & 1,
                        create_time: result[i].create_time,
                        checkins: {},
                    };
                    habits.push(h);
                    habitMap[h.id] = h;
                    if (h.enable) {
                        activeHabits[h.id] = true;
                        activeHabitCount ++;
                    } else {
                        inactiveHabitCount ++;
                    }
                }
                cb();
            });
        },


        function(cb) {
            dbpool.query('select version from versions where uid = ?', [uid], function(err, result) {
                if (err || result.length == 0) {
                    log.log('get version failed for user ' + uid + ': ' + err || 'not exist');
                    return cb(err||'err');
                }
                version = result[0].version;
                cb();
            });
        },


        function(cb) {
            dbpool.query('select * from checkins where uid = ?', [uid], function(err, result) {
                if (err) {
                    log.log('query checkin failed for user ' + uid + ': ' + err);
                    return cb(err);
                }
                checkins = result;
                cb();
            });
        },
    ], function(err, result) {
        if (err) return ierr(res);
        for (var i=0; i<checkins.length; i++) {
            var h = habitMap[checkins[i].hid];
            if (h) {
                h.checkins[checkins[i].year] = [
                    checkins[i].m1,
                    checkins[i].m2,
                    checkins[i].m3,
                    checkins[i].m4,
                    checkins[i].m5,
                    checkins[i].m6,
                    checkins[i].m7,
                    checkins[i].m8,
                    checkins[i].m9,
                    checkins[i].m10,
                    checkins[i].m11,
                    checkins[i].m12,
                ];
            }
        }

        req.session.activeHabits = activeHabits;
        req.session.activeHabitCount = activeHabitCount;
        req.session.inactiveHabitCount = inactiveHabitCount;

        res.json({version: version, uid: uid, habits: habits});
    });

});

// @params: {verison: 11}
// @success return: {version: 12}
// @error return: {error: true, msg: '...'}
router.delete('/api/v1/habits/:hid', function(req, res) {
    var uid = req.session.userid;
    var version = +req.body.version;
    var hid = req.params.hid;
    if (typeof uid == 'undefined' || (+uid) <= 0) {
        return ierr(res, '请登录后再删除习惯');
    }

    if (typeof hid == 'undefined' || (+hid) <= 0) {
        return ierr(res, '参数不合法');
    }

    async.waterfall([
        function(cb) {
            dbpool.getConnection(function(err, conn) {
                if (err) {
                    log.log('error: get connection failed: ' + err);
                    ierr(err);
                    return cb(err);
                }
                cb(null, conn);
            });
        },

        function(conn, cb) {
            conn.beginTransaction(function(err) {
                if (err) {
                    log.log('error: begin transaction failed: ' + err);
                    conn.release();
                    ierr(err);
                    return cb(err);
                }
                cb(null, conn);
            });
        },

        function(conn, cb) {
            conn.query('delete from habits where id = ? and uid = ?', [+hid, +uid], function(err, result) {
                if (err) {
                    log.log('error: delete habit failed: ' + hid);
                    conn.rollback(function() {conn.release();});
                    ierr(err);
                    return cb(err);
                }

                if (result.affectedRows == 0) {
                    log.log("error: can't find habit " + hid + " to delete for user " + uid);
                    conn.rollback(function() {conn.release();});
                    ierr(err, '删除失败，请重新登录再试');
                    return cb('err');
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

                if (req.session.activeHabits[hid]) {
                    req.session.activeHabits[hid] = false;
                    req.session.activeHabitCount --;
                } else {
                    req.session.inactiveHabitCount --;
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
                    version += 2;
                } else {
                    version = result[0].version;
                }
                res.json({version: version});
                cb();
            });
        },
    ]);
});


// @param: {version: 12, checkin: 1/0}
// @success return: {version: 13}
// @error return: {error: true, msg: 'xxx'}
router.put('/api/v1/checkins/:hid_yyyy_mm_dd', function(req, res) {
    var uid = req.session.userid;

    if (!uid || +uid < 0) {
        log.log('error: checkin before login....');
        ierr(res, '尚未登录，请登录后再签到');
        return;
    }

    uid = +uid;

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
                    log.log('err: ' + err);
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


router.get('/api/v1/whoami', function(req, res) {
    var data = {
        id: req.session.userid || -1,
        name: req.session.username || '签到君',
        phone: req.session.phone || '',
        email: req.session.email || '',
    };

    res.json(data);
});

module.exports = router;
