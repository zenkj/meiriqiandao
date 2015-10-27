$(document).ready(function() {
    'use strict';

// Global Data Begin-------------------------------
    // model data
    var M = {
        userid: -1,
        username: '签到君',
        email: '',
        phone: '',
        version: -1,
        activeHabits: [],
        habits: [],
        habitMap: {},
    };
    var MAX_ACTIVE_HABITS = 5;

    // temporary data
    var T = {
        currentPage: 'checkin', // or 'manage'
        currentHabit: null,
        //currentDate: new Date(),
        moving: false,      // table is moving
        autoMoving: false,  // table is auto moving
        waitingCheckins: {},
    };

    // search data
    var S = {
        habits: [],
        habitMap: {},
        $nampMap: {},
    };

// Global Data End---------------------------------


// for Debug Begin-------------------------------
    function log(msg) {
        //console.log(Date.now() + ': ' + msg);
        $('#debug-log').prepend('<p>'+Date.now() + ': ' + msg + '</p>');
    }
    $('#clear-log').click(function() {
        $('#debug-log').empty();
    });
// for Debug End---------------------------------


// Utilities Begin-------------------------------
    function sameYear(d1, d2) {
        return d1.getFullYear() == d2.getFullYear();
    }

    function sameMonth(d1, d2) {
        return sameYear(d1, d2) && d1.getMonth() == d2.getMonth();
    }

    function sameDay(d1, d2) {
        return sameMonth(d1, d2) && d1.getDate() == d2.getDate();
    }

    // @param date: specify the year and month of the table
    // @return a new date which is the first date of the table
    function firstDayOfTable(date) {
        date = date || currentDate();
        var d = new Date(date.getFullYear(), date.getMonth(), 1);
        var delta = d.getDay() - 1;
        if (delta < 0) delta += 7;
        d.setDate(d.getDate() - delta);
        return d;
    }


    // get checkin state or set checkin state
    function checkin(habit, date, state) {
        var i;

        if (!habit) return false;

        var y = date.getFullYear();
        var m = date.getMonth();
        var d = date.getDate() - 1;

        if (typeof state == 'undefined') {
            // get
            var checkined = false;
            if (habit.checkins[y]) {
                var ci = habit.checkins[y][m];
                if (ci & (1<<d))
                    checkined = true;
            }
            return checkined;
        } else {
            // set
            if (!habit.checkins[y]) {
                habit.checkins[y] = [0,0,0,0,0,0,0,0,0,0,0,0];
            }
            if (state) {
                habit.checkins[y][m] |= (1<<d);
            } else {
                habit.checkins[y][m] &= ~(1<<d);
            }
            return true;
        }
    }

    function isWorkDay(habit, date) {
        var i;
        if (!habit) return true;
        var weekday = date.getDay();
        weekday = weekday == 0 ? 7 : weekday;
        return !!(habit.workday & (1<<weekday));
    }

    function workdayDesc(workday) {
        var desc = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        var result = [];
        var i;
        for (i=0; i<7; i++) {
            if (workday & (1<<(i+1)))
                result.push(desc[i]);
        }
        return result.join('，');
    }



    // Get or set current date
    function currentDate(date) {
        if (typeof date == 'undefined') {
            var year = +$('.current-year').text();
            var month = +$('.current-month').text();
            var date = new Date(year, month-1);
            return date;
        } else {
            $('.current-year').text(date.getFullYear());
            $('.current-month').text(date.getMonth()+1);
        }
    }

    // Get or set current habit
    function currentHabit(habit) {
        if (typeof habit == 'undefined') {
            return T.currentHabit;
        } else {
            var last = T.currentHabit;
            T.currentHabit = habit;
            if (last != habit)
                refreshCheckinBody();
        }
    }

    function checkinID(habit, date) {
        var y = date.getFullYear();
        var m = date.getMonth() + 1;
        var d = date.getDate();
        return '' + habit.id + '-' + y + '-' + m + '-' + d;
    }

    function habbitOfCheck(chid) {
        var r = chid.replace('-', ' ').match(/\S+/g);
        if (r && r.length == 2) {
            var hid = +r[0];
            return M.habitMap[hid];
        }
        return null;
    }

    function dateOfCheck(chid) {
        var r = chid.replace('-', ' ').match(/\S+/g);
        if (r && r.length == 2) {
            var dstr = r[1];
            return new Date(dstr);
        }
        return null;
    }

    // get or set state of waiting for checkin on server
    // @param habit   the specific habit
    // @param date    the date to checkin/uncheckin
    // @param action  undefined for query,
    //                'add' for add to waiting list,
    //                'remove' for remove from waiting list
    function waitingServerCheckin(habit, date, action) {
        if (typeof action == 'undefined') {
            // query
            if (!habit || !date) return false;
            return  !!T.waitingCheckins[checkinID(habit, date)];
        } else if (action == 'add') {
            // add
            T.waitingCheckins[checkinID(habit, date)] = true;
        } else if (action == 'remove') {
            // remove
            T.waitingCheckins[checkinID(habit, date)] = false;
        }
    }


    function checkinCount(habit) {
        var year, checkins, i;
        var count = 0;
        var ones = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

        if (typeof habit.checkin_count == 'number')
            return habit.checkin_count;

        function onecount(n) {
            var c = 0;
            c += ones[n&15]; n >>= 4;
            c += ones[n&15]; n >>= 4;
            c += ones[n&15]; n >>= 4;
            c += ones[n&15]; n >>= 4;
            c += ones[n&15]; n >>= 4;
            c += ones[n&15]; n >>= 4;
            c += ones[n&15]; n >>= 4;
            c += ones[n&15];
            return c;
        }

        for (year in habit.checkins) {
            checkins = habit.checkins[year];
            for (i=0; i<checkins.length; i++) {
                count += onecount(checkins[i]);
            }
        }

        return count;
    }

// Utilities End---------------------------------



// Ajax Begin-------------------------------
    var ajax = (function() {
        function request(type, url, data, done, fail) {
            var xhr = $.ajax({url: url,
                type: type,
                data: data || {},
                dataType: 'json',
                cache: false});
            if (done) xhr.done(done);
            if (fail) xhr.fail(fail);
        }

        function get(url, data, done, fail) {
            request('GET', url, data, done, fail);
        }

        function post(url, data, done, fail) {
            request('POST', url, data, done, fail);
        }

        function put(url, data, done, fail) {
            request('PUT', url, data, done, fail);
        }

        function del(url, data, done, fail) {
            request('DELETE', url, data, done, fail);
        }

        return {
            get: get,
            post: post,
            put: put,
            delete: del,
        };
    })();
// Ajax End---------------------------------


// Adjust Date Begin-------------------------

    // slide to or switch to the destination month
    // if the current month is near the dest month, then slide,
    // otherwise switch.
    // todate can be destination month or number offset to the current month 
    function slideTo(todate) {
        // update checkin table
        // adjust the table position, center it
        function resetTable(date) {
            var i,j,k;
            var date = new Date(date.getTime());
            var dates = [];
            var months = [];

            date.setMonth(date.getMonth()-1);
            for (i=0; i<3; i++) {
                dates.push(firstDayOfTable(date));
                months.push(date.getMonth());
                date.setMonth(date.getMonth()+1);
            }

            var today = new Date();

            var $trs = $('.checkin-table tr');
            for (i=0; i<6; i++) {
                var $tr = $trs.eq(i+1);
                var $tds = $('td', $tr);
                for (j=0; j<3; j++) {
                    for (k=0; k<7; k++) {
                        var $td = $tds.eq(j*7+k);
                        $td.text(dates[j].getDate());
                        if (dates[j].getMonth() == months[j]) {
                            $td.addClass("in-current-month");
                        } else {
                            $td.removeClass("in-current-month");
                        }

                        if (sameDay(dates[j], today)) {
                            $td.addClass("is-today");
                        } else {
                            $td.removeClass("is-today");
                        }

                        updateCheckin($td, dates[j]);

                        dates[j].setDate(dates[j].getDate()+1);
                    }
                }
            }
            $('.checkin-table').css('left', '-100%');
        }


        function gotoDate(date) {

            resetTable(date);
            currentDate(date);
            var today = new Date();
            if (sameMonth(date, today)) {
                $('.return-today').removeClass('display');
            } else {
                $('.return-today').addClass('display');
            }
        }

        var cd = currentDate();
        cd.setDate(1);

        var deltaMonth = 0;

        if (typeof todate == 'number') {
            cd.setMonth(cd.getMonth()+todate);
            if (todate <-1 || todate >1) {
                gotoDate(cd);
                return;
            }
            deltaMonth = todate;
            todate = cd;
        } else {
            todate.setDate(1);
            var prev = new Date(cd.getTime());
            var next = new Date(cd.getTime());
            prev.setMonth(prev.getMonth()-1);
            next.setMonth(next.getMonth()+1);
            if (sameMonth(cd, todate)) {
                deltaMonth = 0;
            } else if (sameMonth(next, todate)) {
                deltaMonth = 1;
            } else if (sameMonth(prev, todate)) {
                deltaMonth = -1;
            } else {
                gotoDate(todate);
                return;
            }
        }

        // deltaMonth can only be -1, 0, or 1
        // means auto move to prev month, current month, or next month
        var $table = $('.checkin-table');
        var $container = $table.parent();
        var date = todate;
        var destLeft = (-deltaMonth-1)*$container.width();
        if($table.position().left == destLeft) {
            gotoDate(date);
            T.moving = false;
        } else {
            $table.addClass('auto-move');
            $table.css('left', ''+destLeft+'px');
            T.autoMoving = true;

            // weixin X5 engine need webkitTransitionEnd
            $table.one('webkitTransitionEnd oTransitionEnd otransitionend transitionend', function() {
                log('transition end');
                $table.removeClass('auto-move');
                T.autoMoving = false;
                gotoDate(date);
                T.moving = false;
            });
        }
    }

    $('.return-today').click(function() {
        slideTo(new Date());
    });
// Adjust Date End---------------------------

// Register Listeners Begin ---------------------

    $('.checkin-table').each(function() {
        var hc = new Hammer(this);
        var swiped = false;
        var $table = $(this);
        var $container = $table.parent();
        var startLeft = 0;
        var i,j,k;

        $table.on('touchstart', function() {
            log('touch start');
        });

        $table.on('touchend', function() {
            log('touch end');
        });

        $table.on('mousedown', function() {
            log('mouse down');
        });

        $table.on('mouseup', function() {
            log('mouse up');
        });


        hc.on('swipeleft', function(e) {
            log('swipe left');
            if (T.autoMoving) return;
            swiped = true;
            slideTo(1);
        });
        hc.on('swiperight', function(e) {
            log('swipe right');
            if (T.autoMoving) return;
            swiped = true;
            slideTo(-1);
        });
        hc.on('panstart', function(e) {
            log('panstart: deltaX='+e.deltaX);
            if (T.autoMoving) return;
            T.moving = true;
            swiped = false;
            startLeft = $('.checkin-table').position().left;
        });
        hc.on('panmove', function(e) {
            log('panmove: deltaX=' + e.deltaX);
            if (T.autoMoving) return;
            var left = startLeft + e.deltaX;
            var width = $table.outerWidth() / 3.0;
            if (left <= 0 && left >= -2*width) {
                $table.css('left', ''+left+'px');
            }
        });

        hc.on('panend', function(e) {
            log('panend: deltaX='+ e.deltaX);
            if (T.autoMoving) return;
            if (swiped) {
                swiped = false;
                return;
            }
            var left = $table.position().left;
            var width = $container.width();

            var deltaMonth = 0;
            if (left > -0.5*width) {
                deltaMonth = -1;
            } else if (left < -1.5*width) {
                deltaMonth = 1;
            }

            slideTo(deltaMonth);
        });

        function toggleCheckin(e) {
            if (M.habits.length == 0) {
                infoDialog('提醒', '请先创建一个习惯');
                return;
            }

            if (M.activeHabits.length == 0) {
                infoDialog('提醒', '请创建或启用一个习惯');
                return;
            }

            if (!T.currentHabit) {
                infoDialog('提醒', '请选择一个习惯');
                return;
            }

            var td = e.target;
            var $td = $(td);
            if (!$td.data('tposition')) {
                log('td not in current table segment is clicked');
                return;
            }


            var date = firstDayOfTable();
            date.setDate(date.getDate()+$td.data('tposition')-1);
            var checkined = checkin(T.currentHabit, date);

            if ($td.hasClass('wait-server-response')) {
                log('the server do not answer me:-(');
                return;
            }

            if (M.userid < 0) {
                // dummy user
                checkin(T.currentHabit, date, !checkined);
                updateHabit(T.currentHabit);
                updateCheckin($td, date);
            } else {
                ajax.put('/api/v1/checkins/'+checkinID(T.currentHabit, date),
                        {version: M.version, checkin: checkined ? 0 : 1},
                        function(data) {
                            waitingServerCheckin(T.currentHabit, date, 'remove');
                            if (data.error) {
                                log('update checkin error: ' + data.msg);
                                infoDialog('错误', data.msg);
                                updateCheckins();
                            } else {
                                if (data.version == M.version + 1) {
                                    // everything is ok
                                    M.version = data.version;
                                    checkin(T.currentHabit, date, !checkined);
                                    updateHabit(T.currentHabit);
                                    updateCheckins();
                                } else {
                                    // someone else has updated elsewhere
                                    refresh();
                                }
                            }
                        },
                        function(xhr, err) {
                            waitingServerCheckin(T.currentHabit, date, 'remove');
                            updateCheckins();
                            log('update checkin error: ' + err);
                        });
                waitingServerCheckin(T.currentHabit, date, 'add');
            }
        }

        var $trs = $('tr', $table);
        var $tr, $tds, $td;
        k = 1;
        for (i=1; i<7; i++) {
            $tr = $trs.eq(i);
            $tds = $('td', $tr);
            for (j=0; j<7; j++) {
                $td = $tds.eq(j+7);
                $td.data('tposition', k++);
                hc = new Hammer($td[0]);
                hc.on('tap', toggleCheckin);
            }
        }

    });


    $('#active-habit-list').on('click', 'li', function(e) {
        var $target = $(e.currentTarget);
        var hid = $target.data('hid');

        currentHabit(M.habitMap[hid]);

    });


    $('#to-signup').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function(e) {
            var $login = $('#dialog-login');
            e.preventDefault();
            $login.modal('hide');
            $login.one('hidden.bs.modal', function() {
                var $signup = $('#dialog-signup');
                $signup.modal('show');
            });
        });
    });

    $('#to-login').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function(e) {
            var $signup = $('#dialog-signup');
            e.preventDefault();
            $signup.modal('hide');
            $signup.one('hidden.bs.modal', function() {
                var $login = $('#dialog-login');
                $login.modal('show');
            });
        });
    });

    function setError($e, msg) {
        if (!$e || $e.length == 0)
            return;
        var $p = $e.parent();
        var $pp = $p.parent();
        var $msg = $('.error-message', $pp)
        $p.removeClass('has-success');
        $p.addClass('has-error');
        if ($p.hasClass('has-feedback')) {
            var $f = $('.form-control-feedback', $p);
            $f.removeClass('glyphicon-ok');
            $f.addClass('glyphicon-remove');
        } else {
            $p.addClass('has-feedback');
            $p.append('<span class="glyphicon glyphicon-remove form-control-feedback" aria-hidden="true"></span>');
        }

        if (msg) {
            $msg.text(msg).css({display: 'block'});
        } else {
            $msg.css({display: 'none'});
        }
    }

    function setSuccess($e) {
        if (!$e || $e.length == 0)
            return;
        var $p = $e.parent();
        $p.removeClass('has-error');
        $p.addClass('has-success');
        if ($p.hasClass('has-feedback')) {
            var $f = $('.form-control-feedback', $p);
            $f.removeClass('glyphicon-remove');
            $f.addClass('glyphicon-ok');
        } else {
            $p.addClass('has-feedback');
            $p.append('<span class="glyphicon glyphicon-ok form-control-feedback" aria-hidden="true"></span>');
        }
    }

    function removeCheck($e) {
        var $p = $e.parent();
        $p.removeClass('has-success');
        $p.removeClass('has-error');
        $p.removeClass('has-feedback');
        $('.form-control-feedback', $p).remove();
    }

    function infoDialog(title, msg) {
        $('#dialog-info-title').text(title||'提示');
        $('#dialog-info-message').text(msg||'提示信息');
        $('#dialog-info').modal('show');
    }

    function yesnoDialog(title, msg, yescb, nocb) {
        var $dialog = $('#dialog-confirm')
        $('#dialog-confirm-title').text(title||'确认');
        $('#dialog-confirm-message').text(msg||'确认信息');
        $dialog.data('confirmed', false);
        $dialog.modal('show');
        $dialog.one('hidden.bs.modal', function() {
            if ($dialog.data('confirmed')) {
                if (yescb) yescb();
            } else {
                if (nocb) nocb();
            }
        });
    }

    $('#button-confirm').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            var $dialog = $('#dialog-confirm')
            $dialog.data('confirmed', true);
            $dialog.modal('hide');
        });
    });

    $('#button-logout').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            yesnoDialog('确认', '确认退出？',
                function() {
                    ajax.post('/logout', {},
                        function(data) {
                            if (data.error) {
                                infoDialog('错误', '退出出错：' + data.msg);
                            } else {
                                M.userid = data.userid;
                                M.username = data.username;
                                M.version = -1;
                                refresh();
                            }
                        }, function(xhr, err) {
                            infoDialog('错误', '退出出错，请稍后再试');
                        });
                });
        });
        
    });


    $('#button-signup').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            var $dialog = $('#dialog-signup');
            var $errmsg = $('error-message', $dialog);
            var $name = $('#signup-name');
            var $phone = $('#signup-phone');
            var $email = $('#signup-email');
            var $password1 = $('#signup-password');
            var $password2 = $('#signup-password-again');
            var $password = $('#signup-password, #signup-password-again');
            var name = $.trim($name.val() || '');
            var phone = $.trim($phone.val() ||'');
            var email = $.trim($email.val() ||'');
            var password1 = $.trim($password1.val() ||'');
            var password2 = $.trim($password2.val() ||'');
            var phone1 = (phone.match(/\d+/g)||[])[0];


            function init() {
                $errmsg.css('display', 'none');
                removeCheck($name);
                removeCheck($phone);
                removeCheck($email);
                removeCheck($password1);
                removeCheck($password2);
            }

            init();


            if (name.length == 0) {
                setError($name, '名字不能为空');
                return;
            } else {
                setSuccess($name);
            }

            if (!phone1 || phone1 != phone || phone1.length != 11) {
                setError($phone, '手机号格式错误，请输入11个阿拉伯数字');
                return;
            } else {
                setSuccess($phone);
            }

            if (email.length > 0 && !email.match(/^([\w.-]+)@(.*)(\.\w+)$/)) {
                setError($email, '邮箱格式错误');
                return;
            } else {
                setSuccess($email);
            }

            if (password1.length < 6) {
                setError($password1, '密码长度不足6个字符');
                return;            
            } else {
                setSuccess($password1);
            }

            if (password1 !== password2) {
                setError($password, '密码不匹配');
                return;            
            } else {
                setSuccess($password2);
            }

            ajax.post('/signup', {
                name: name,
                phone: phone,
                email: email,
                password: password1,
            }, function(data) {
                if (data.error) {
                    var ids = {
                        name: $name,
                        phone: $phone,
                        email: $email,
                        password: $password,
                    };
                    setError(ids[data.data] || $name, data.msg);
                    return;
                }
                    
                init();
                $dialog.modal('hide');
                $dialog.one('hidden.bs.modal', function() {
                    infoDialog('注册成功！', '请使用手机号或邮箱登录');
                });
            }, function(xhr, err) {
                init();
                $dialog.modal('hide');
                $dialog.one('hidden.bs.modal', function() {
                    infoDialog('注册失败！',  err);
                });
            });
        });
    });

    $('#button-login').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            var $dialog = $('#dialog-login');
            var $user = $('#login-user');
            var $password = $('#login-password');
            var $errmsg = $('.error-message', $dialog);
            var $all = $('#login-user,#login-password');
            var user = $.trim($user.val() || '');
            var password = $.trim($password.val() || '');

            var phone = (user.match(/\d+/g) || [])[0];
            var email = user.match(/^([\w.-]+)@(.*)(\.\w+)$/);

            $errmsg.css('display', 'none');
            removeCheck($user);
            removeCheck($password);

            if (user.length == 0 || ((phone!=user || phone.length!=11) && !email)) {
                setError($user, '请使用邮箱或手机号登录');
                return;
            }

            if (password.length == 0) {
                setError($password, '密码不能为空');
                return;
            }

            ajax.post('/login', {
                user: user,
                password: password,
            }, function(data) {
                if (data.error) {
                    setError($all, '邮箱、手机号或密码错误，请重试');
                    return;
                }

                M.userid = data.userid;
                M.username = data.username;
                M.phone = data.phone;
                M.email = data.email;
                M.version = -1;

                $errmsg.css('display', 'none');
                $dialog.modal('hide');
                refresh();
            }, function(xhr, err) {
                $dialog.modal('hide');
                $dialog.one('hidden.bs.modal', function() {
                    infoDialog('登录失败！', err);
                });
            });
        });
    });

    $('#button-new-habit').click(function() {
        var $dialog = $('#dialog-new-habit');
        var $name = $('#new-habit-name');
        var $workdays = $('#new-habit-workdays input:checked');
        var $errmsg = $('.error-message', $dialog);
        var name = $.trim($name.val() || '');
        var workdays = 0;

        function init() {
            $errmsg.css('display', 'none');
            removeCheck($name);
        }
        init();

        if (M.userid < 0) {
            $dialog.modal('hide');
            $dialog.one('hidden.bs.modal', function() {
                infoDialog('提醒', '登录后才能创建新习惯');
            });
            return;
        }


        if (name.length == 0) {
            setError($name, '习惯名字不能为空！');
            return;
        }

        $workdays.each(function() {
            var wd = +$(this).val();
            if (wd>=1 && wd<=7)
                workdays |= (1<<wd);
        });

        ajax.post('/api/v1/habits', {
            version: M.version,
            name: name,
            workday: workdays
        }, function(data) {
            if (data.error) {
                setError($name, data.msg);
                return;
            }

            init();
            $dialog.modal('hide');

            if (!data.habit.enable) {
                infoDialog('提醒', '当前激活的习惯过多，新创建的习惯处于未激活状态。请先禁用一个激活的习惯，再启用该习惯');
            }

            if (data.version == M.version+1) {
                M.version += 1;
                M.habits.unshift(data.habit);
                M.habitMap[data.habit.id] = data.habit;
                if (data.habit.enable) {
                    M.activeHabits.unshift(data.habit);
                    T.currentHabit = data.habit;
                    newHabitDOM(data.habit);
                    refreshBodyDOM();
                }

                generatePinyin(data.habit);
            } else {
                refresh();
            }
        }, function(xhr, err) {
            init();
            $dialog.modal('hide');
            $dialog.one('hidden.bs.modal', function() {
                infoDialog('创建失败', err);
            });
        });
    });


    $('#button-change-habit').click(function() {
        var $dialog = $('#dialog-change-habit');
        var $name = $('#change-habit-name');
        var $workdays = $('#change-habit-workdays input:checked');
        var $errmsg = $('.error-message', $dialog);
        var name = $.trim($name.val() || '');
        var workdays = 0;
        var habit = M.habitMap[$dialog.data('hid')];

        function init() {
            $errmsg.css('display', 'none');
            removeCheck($name);
        }
        init();

        if (name.length == 0) {
            setError($name, '习惯名字不能为空！');
            return;
        }

        $workdays.each(function() {
            var wd = +$(this).val();
            if (wd>=1 && wd<=7)
                workdays |= (1<<wd);
        });

        if (name == habit.name && workdays == habit.workday) {
            init();
            $dialog.modal('hide');
            return;
        }

        if (M.userid < 0) {
            // dummy user
            if (habit.name != name) {
                habit.name = name;
                generatePinyin(habit);
            }
            habit.workday = workdays;
            refreshBodyDOM();
            init();
            $dialog.modal('hide');
            return;
        }

        ajax.put('/api/v1/habits/'+habit.id, {
            version: M.version,
            name: name,
            workday: workdays
        }, function(data) {
            if (data.error) {
                setError($name, data.msg);
                return;
            }

            init();
            $dialog.modal('hide');

            if (data.version == M.version+1) {
                M.version += 1;
                habit.name = name;
                habit.workday = workdays;
                refreshBodyDOM();
            } else {
                refresh();
            }
        }, function(xhr, err) {
            init();
            $dialog.modal('hide');
            $dialog.one('hidden.bs.modal', function() {
                infoDialog('修改失败', err);
            });
        });
    });


    $('#dialog-user-config').on('show.bs.modal', function() {
        var $errmsg = $('#dialog-user-config .error-message');
        $errmsg.css('display', 'none');
        removeCheck($('#user-config-name').val(M.username));
        removeCheck($('#user-config-phone').val(M.phone));
        removeCheck($('#user-config-email').val(M.email));
    });

    $('#dialog-new-habit').on('show.bs.modal', function() {
        var $errmsg = $('#dialog-new-habit .error-message');
        $errmsg.css('display', 'none');
        removeCheck($('#new-habit-name'));
    });

    $('#button-user-config').click(function() {
        var $dialog = $('#dialog-user-config');
        var $errmsg = $('.error-message', $dialog);
        var $name = $('#user-config-name');
        var $phone = $('#user-config-phone');
        var $email = $('#user-config-email');

        var name = $.trim($name.val()||'');
        var phone = $.trim($phone.val()||'');
        var phone1 = (phone.match(/\d+/g)||[])[0];
        var email = $.trim($email.val()||'');

        function init() {
            $errmsg.css('display', 'none');
            removeCheck($name);
            removeCheck($phone);
            removeCheck($email);
        }

        init();

        if (name.length == 0) {
            setError($name, '名字不能为空');
            return;
        } else {
            setSuccess($name);
        }

        if (!phone1 || phone1 != phone || phone1.length != 11) {
            setError($phone, '手机号格式错误，请输入11个阿拉伯数字');
            return;
        } else {
            setSuccess($phone);
        }

        if (email.length > 0 && !email.match(/^([\w.-]+)@(.*)(\.\w+)$/)) {
            setError($email, '邮箱格式错误');
            return;
        } else {
            setSuccess($email);
        }

        if (name == M.username && phone == M.phone && email == M.email) {
            init();
            $dialog.modal('hide');
            return;
        }

        ajax.post('/user-config', {
            version: M.version,
            name: name,
            phone: phone,
            email: email,
        }, function(data) {
            if (data.error) {
                var ids = {
                    name: $name,
                    phone: $phone,
                    email: $email,
                };
                setError(ids[data.data] || $name, data.msg);
                return;
            }

            init();
            $dialog.modal('hide');
            if (data.uid == M.userid && data.version == M.version+1) {
                M.version += 1;
                refreshNav();
            } else {
                refresh();
            }
        }, function(xhr, err) {
            init();
            $dialog.modal('hide');
            $dialog.one('hidden.bs.modal', function() {
                infoDialog('修改失败！',  err);
            });
        });
    });

    $('#button-manage-habits').click(function() {
        $('#button-manage-habits').css('display', 'none');
        $('#checkin-body').css('display', 'none');
        $('#button-checkin').css('display', 'block');
        $('#manage-body').css('display', 'block');
    });

    $('#button-checkin').click(function() {
        $('#button-checkin').css('display', 'none');
        $('#button-manage-habits').css('display', 'block');
        $('#manage-body').css('display', 'none');
        $('#checkin-body').css('display', 'block');
    });

    function refreshSearch() {
        S.habits = [];
        S.habitMap = {};
        S.$nameMap = {};
    }

    $('#search-habit-text').each(function() {
        var $container = $('#all-habit-list');
        var $this = $(this);

        function escapeRegexChars(s) {
            return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        }

        $this.on('focus', function() {
            var $newHabits = $('#all-habit-list > li');
            var i;
            for (i=$newHabits.length-1; i>=0; i--) {
                var h = $newHabits[i];
                var hid = $(h).data('hid');
                if (!S.habitMap[hid]) {
                    S.habits.unshift(h);
                    S.habitMap[hid] = h;
                    S.$nameMap[hid] = $('.habit-name', h);
                }
            }
        });

        $this.on('blur', function() {
            // seems nothing to do
        });

        function decorate(name, matches) {
            var i, j, p1, p2;
            var result = [];
            for (i=0,j=0; i<name.length;) {
                if (j >= matches.length)
                    break;
                p1 = matches[j][0];
                p2 = matches[j][1];
                if (i < p1) {
                    result.push(name.substring(i, p1));
                }
                result.push('<span class="matched">' + name.substring(p1, p2) + '</span>');
                j++;
                i = p2;
            }

            if (i<name.length)
                result.push(name.substring(i, name.length));

            return result.join('');
        }

        function matchHabit(habit, regexp) {
            var dom = S.habitMap[habit.id];
            var $name = S.$nameMap[habit.id];
            if (!dom || !$name) return null;
            var count = 0,
                count1 = 0,
                count2 = 0;
            var newname = habit.name.replace(regexp,
                             function(old) {
                                 count += old.length;
                                 return '<span class="matched">'+old+'</span>';
                             });

            if (habit.pinyinName) {
                var matches1 = [];
                var matches2 = [];
                habit.pinyinName.replace(regexp, function(old, offset) {
                    var p1 = offset;
                    var p2 = offset + old.length-1;
                    var i, i1=-1, i2=-1;
                    for(i=0; i<habit.pinyinPos.length; i++) {
                        if (p1 == habit.pinyinPos[i]) {
                            i1 = i;
                            break;
                        } else if (p1 < habit.pinyinPos[i]) {
                            i1 = i-1;
                            break;
                        }
                    }
                    if (i1 < 0) i1 = habit.pinyinPos.length-1;

                    for (i=0; i<habit.pinyinPos.length; i++) {
                        if (p2 == habit.pinyinPos[i]) {
                            i2 = i+1;
                            break;
                        } else if (p2 < habit.pinyinPos[i]) {
                            i2 = i;
                            break;
                        }
                    }
                    if (i2 < 0) i2 = habit.pinyinPos.length;

                    count1 += i2-i1;

                    matches1.push([i1,i2]);
                });

                habit.pinyinAcronym.replace(regexp, function(old, offset) {
                    count2 += old.length;
                    matches2.push([offset, offset+old.length]);
                });
            }

            if (count2 >= count1 && count2 > count) {
                // 首字母缩写优先级更高
                count = count2;
                newname = decorate(habit.name, matches2);
            } else if (count1 > count2 && count1 > count) {
                count = count1;
                newname = decorate(habit.name, matches1);
            }

            if (count > 0) {
                $name.html(newname);
                return [count, dom];
            }

            return null;
        }

        $this.on('input', function() {
            var i, h, $name, value = $.trim($this.val()||'');
            $(S.habits).detach();
            if (value.length == 0) {
                for (i=0; i<M.habits.length; i++) {
                    h = M.habits[i];
                    $name = S.$nameMap[h.id];
                    if (!$name) continue;
                    $name.text(h.name);
                }
                $container.append(S.habits);
            } else {
                var keys = value.match(/\S+/g).map(function(s) {return escapeRegexChars(s);});
                var regexp = new RegExp(keys.join('|'), 'g');
                var matchedHabits = [];
                for (i=0; i<M.habits.length; i++) {
                    h = M.habits[i];
                    var result = matchHabit(h, regexp);
                    if (result) {
                        matchedHabits.push(result);
                    }
                }

                matchedHabits = matchedHabits.sort(function(x,y) {return y[0]-x[0];}).map(function(x) {return x[1];});

                $container.append(matchedHabits);
            }
        });
    });


    $('#all-habit-list').on('click', 'li', function(e) {
        var $target = $(e.target);
        var $ctarget = $(e.currentTarget);
        var activator = $target.hasClass('activator');
        var h = M.habitMap[$ctarget.data('hid')];
        if (!h) {
            if (activator) $target.prop('checked', !$target.prop('checked'));
            return infoDialog('提示', '操作失败，请重新登录');
        }
        if (activator) {
            var active = $target.prop('checked');
            if (active && M.activeHabits.length >= MAX_ACTIVE_HABITS) {
                $target.prop('checked', false);
                return infoDialog('提示', '启用的习惯过多，请先禁用一些启用的习惯再启用该习惯');
            }
            if (M.userid < 0) {
                activeHabit(h, active);
            } else {
                ajax.put('/api/v1/habits/'+h.id,
                        {version: M.version,
                        enable: +active},
                        function(data) {
                            if (data.error) {
                                return infoDialog('错误', data.msg);
                            }
                            if (data.version == M.version+1) {
                                M.version ++;
                                activeHabit(h, active);
                            } else {
                                refresh();
                            }
                        }, function(xhr, err) {
                            infoDialog('错误', '与服务器连接出错');
                        });
            }
        } else {
            if (M.userid < 0) {
                infoDialog('提示', '登录后，点击习惯可以对其进行编辑');
                return;
            }
            var $dialog = $('#dialog-change-habit');
            var $errmsg = $('.error-message', $dialog);
            var $name = $('#change-habit-name');
            var $workdays = $('#change-habit-workdays input');
            $errmsg.css('display', 'none');
            $name.val(h.name);
            for (var i=0; i<7; i++) {
                if (h.workday & (1<<(i+1))) {
                    $workdays.eq(i).prop('checked', true);
                } else {
                    $workdays.eq(i).prop('checked', false);
                }
            }

            $dialog.data('hid', h.id);

            $dialog.modal('show');
        }

    });
// Register Listeners End ------------------------



// Refresh DOM begin -----------------------------

    function activeHabit(h, active) {
        var i;
        h.enable = +active;
        if (active) {
            for (i=0; i<M.activeHabits.length; i++) {
                if (M.activeHabits[i].id < h.id) {
                    break;
                }
            }
            if (i < M.activeHabits.length) {
                M.activeHabits.splice(i, 0, h);
            } else {
                M.activeHabits.push(h);
            }

            newCheckinHabitDOM(h);
        } else {
            var activeHabits = [];
            for (i=0; i<M.activeHabits.length; i++) {
                if (M.activeHabits[i].id == h.id)
                    break;
            }

            if (i<M.activeHabits.length) {
                M.activeHabits.splice(i,1);
            }

            removeCheckinHabitDOM(h);
        }
        refreshBodyDOM();
    }

    // update one checkin in table according to the habit setting
    function updateCheckin($td, date) {
        var checkined = checkin(T.currentHabit, date);

        if (checkined) {
            $td.addClass('checkined');
        } else {
            $td.removeClass('checkined');
        }

        var workday = isWorkDay(T.currentHabit, date);
        if (workday) {
            $td.removeClass('rest-day');
        } else {
            $td.addClass('rest-day');
        }

        var waiting = waitingServerCheckin(T.currentHabit, date);
        if (waiting) {
            $td.addClass('wait-server-response');
        } else {
            $td.removeClass('wait-server-response');
        }
    }

    // update checkins in table
    function updateCheckins() {
        var i,j,k;
        var date = currentDate();
        date.setMonth(date.getMonth()-1);
        var dates = [];

        for (i=0; i<3; i++) {
            dates.push(firstDayOfTable(date));
            date.setMonth(date.getMonth()+1);
        }

        var $trs = $('.checkin-table tr');
        for (i=0; i<6; i++) {
            var $tr = $trs.eq(i+1);
            var $tds = $('td', $tr);
            for (j=0; j<3; j++) {
                for (k=0; k<7; k++) {
                    var $td = $tds.eq(j*7+k);

                    updateCheckin($td, dates[j]);

                    dates[j].setDate(dates[j].getDate()+1);
                }
            }
        }
    }


    // update habit basic style
    function baseUpdateHabit($habit, habit) {
        $('.checkin-count', $habit).text(checkinCount(habit));
        $habit.removeClass('list-group-item-success');
        $habit.removeClass('list-group-item-info');
        $habit.removeClass('list-group-item-warning');
        $habit.removeClass('list-group-item-danger');

        if (!habit.enable) return;

        var date = new Date();
        var i = 0;
        var INFO = 2;
        var WARNING = 5;
        var ERROR = 8;
        var cdate = new Date(habit.create_time);
        while (!sameDay(date, cdate) && i < ERROR) {
            if (isWorkDay(habit, date) && !checkin(habit, date))
                i++;
            date.setDate(date.getDate()-1);
        }

        var state = 'list-group-item-success';
        if (i >= ERROR)
            state = 'list-group-item-error';
        else if (i >= WARNING)
            state = 'list-group-item-warning';
        else if (i >= INFO)
            state = 'list-group-item-info';

        $habit.addClass(state);
    }

    // update habit at management-body
    function updateManageHabit($habit, habit) {
        if (typeof habit == 'undefined') {
            habit = $habit;
            $habit = $('#all-habit-list li').filter(function(){return $(this).data('hid') == habit.id;});
        }

        var $hname = $('.habit-name', $habit);
        $hname.text(habit.name);
        var cdate = new Date(habit.create_time);
        var $hdesc1 = $('.habit-desc1', $habit);
        $hdesc1.text('' + cdate.getFullYear() + '年' + (cdate.getMonth()+1) + '月' + cdate.getDate() + '日');
        var $hdesc2 = $('.habit-desc2', $habit);
        $hdesc2.text(workdayDesc(habit.workday));

        baseUpdateHabit($habit, habit);
    }

    // update habit at checkin-body
    function updateCheckinHabit($habit, habit) {
        if (typeof habit == 'undefined') {
            habit = $habit;
            $habit = $('#active-habit-list li').filter(function(){return $(this).data('hid') == habit.id;});
        }

        $('.habit-name',$habit).text(habit.name);

        baseUpdateHabit($habit, habit);

        if (habit == T.currentHabit) {
            $habit.addClass('active');
        } else {
            $habit.removeClass('active');
        }
    }


    function updateHabit($habit, habit) {
        updateCheckinHabit($habit, habit);
        updateManageHabit($habit, habit);
    }


    function firstHabitLessThan($habits, habit) {
        for (var i=0; i<$habits.length; i++) {
            var $habit = $habits.eq(i);
            if ($habit.data('hid') < habit.id)
                return $habit;
        }
        return null;
    }

    function newCheckinHabitDOM(habit) {
        var $habits = $('#active-habit-list > li');
        var $habit = $('<li></li>');
        $habit.data('hid', habit.id);
        $habit.addClass('habit list-group-item');
        $habit.append('<span class="habit-name"></span>');
        $habit.append('<span class="badge checkin-count"></span>');

        var $below = firstHabitLessThan($habits, habit);
        if ($below) {
            $habit.insertBefore($below);
        } else {
            $('#active-habit-list').append($habit);
        }
        return $habit;
    }

    function removeCheckinHabitDOM(habit) {
        var $habits = $('#active-habit-list > li');
        for (var i=0; i<$habits.length; i++) {
            var $habit = $habits.eq(i);
            if ($habit.data('hid') == habit.id) {
                $habit.remove();
                break;
            }
        }
    }

    // update habits in habit list of checkin page
    // @param recreateDOM: true: the model is changed, recreate related dom object
    //                 false: the model is not changed, reuse the dom object
    function updateCheckinHabits(recreateDOM) {
        var i, hid, habit, $habits, $habit;
        var $list = $('#active-habit-list');

        if (M.activeHabits.length > 0) {
            if (!T.currentHabit) {
                T.currentHabit = M.activeHabits[0];
            } else {
                T.currentHabit = M.habitMap[T.currentHabit.id];
                if (!T.currentHabit || !T.currentHabit.enable)
                    T.currentHabit = M.activeHabits[0];
            }
        } else {
            T.currentHabit = null;
        }

        if (recreateDOM) $list.empty();
        else $habits = $('li', $list);

        for (i=0; i<M.activeHabits.length; i++) {
            habit = M.activeHabits[i];

            if (recreateDOM) {
                $habit = newCheckinHabitDOM(habit);
            } else {
                $habit = $habits.filter(function() {
                    return $(this).data('hid') == habit.id;
                    });
            }

            updateCheckinHabit($habit, habit);
        }
    }

    function newManageHabitDOM(habit) {
        var $habits = $('#all-habit-list > li');
        var $habit = $('<li></li>');
        $habit.data('hid', habit.id);
        $habit.addClass('habit list-group-item');
        $habit.append('<span class="badge checkin-count"></span>');
        $habit.append('<input type="checkbox" class="activator" '+(habit.enable ? "checked" : "")+'>');
        var $hinfo = $('<div class="habit-info"></div>');
        $hinfo.append('<h5 class="habit-name"></h5>');
        $hinfo.append('<p class="habit-desc">创建于<span class="habit-desc1"></span></p>');
        $hinfo.append('<p class="habit-desc">签到时间为<span class="habit-desc2"></span></p>');
        $habit.append($hinfo);

        var $below = firstHabitLessThan($habits, habit);
        if ($below) {
            $habit.insertBefore($below);
        } else {
            $('#all-habit-list').append($habit);
        }
        return $habit;
    }


    function newHabitDOM(habit) {
        newCheckinHabitDOM(habit);
        newManageHabitDOM(habit);
    }

    // update habits in habit list of management page
    // @param recreateDOM: true: the model is changed, recreate related dom object
    //                 false: the model is not changed, reuse the dom object
    function updateManageHabits(recreateDOM) {
        var i, habit, $habit, $habits, $list = $('#all-habit-list');
        if (recreateDOM) $list.empty();
        else $habits = $('li', $list);

        // refresh Management Habits
        for (i=0; i<M.habits.length; i++) {
            habit = M.habits[i];
            if (recreateDOM) {
                $habit = newManageHabitDOM(habit);
            } else {
                $habit = $habits.filter(function() {
                    return $(this).data('hid') == habit.id;
                });
            }
            updateManageHabit($habit, habit);
        }
    }

    // refresh management body
    function refreshManageBody(recreateDOM) {
        // refresh Management Header
        var activeCount = M.activeHabits.length;
        var inactiveCount = M.habits.length - activeCount;
        $('#active-habit-count').text(activeCount);
        $('#inactive-habit-count').text(inactiveCount);

        if (recreateDOM) {
            refreshSearch();
            $('#search-habit-text').val('');
        }

        updateManageHabits(recreateDOM);
    }

    // refresh view after big model changed (from MVC perspective)
    function refreshCheckinBody(recreateDOM) {
        updateCheckinHabits(recreateDOM);
        updateCheckins();
    }

    function refreshBodyDOM(recreateDOM) {
        refreshCheckinBody(recreateDOM);
        refreshManageBody(recreateDOM);
    }

    function generatePinyin(habits) {
        if (!window['txpinyin']) return;

        if (typeof habits == 'undefined')
            habits = M.habits;
        if (typeof habits.length == 'undefined' && 
            typeof habits.name == 'string')
            habits = [habits];

        for (var i=0; i<habits.length; i++) {
            var h = habits[i];
            var py = txpinyin(h.name);
            if (py.hasHanzi) {
                h.pinyinName = py.pinyin;
                h.pinyinAcronym = py.acronym;
                h.pinyinPos = py.pos;
            }
        }
    }


    function refreshBody() {
        ajax.get('/api/v1/habits', {}, function(data) {
            var i, h;
            if (data.error) {
                log('get checkins error: ' + data.msg);
                infoDialog('提示', '从服务器获取信息失败，请重新刷新');
                return;
            }
            // refreshBody is accompanied with refreshNav(whoami), so no need to check this
            //if (M.userid != data.uid) {
            //    infoDialog('错误', '会话超时，请重新打开页面登录(' + M.userid + ':' + data.uid + ')');
            //    return;
            //}
            if (M.userid == data.uid && M.version == data.version) {
                log('no data changed on server, every thing is ok');
                return;
            }
            M.version = data.version;
            M.habits = data.habits;

            M.activeHabits = [];
            M.habitMap = {};
            for (i=0; i<M.habits.length; i++) {
                h = M.habits[i];
                M.habitMap[h.id] = h;
                if (h.enable) {
                    M.activeHabits.push(h);
                }
            }

            generatePinyin();

            refreshBodyDOM(true);
        },
        function(xhr, err) {
            log('get checkin data failed');
            infoDialog('错误', '连接服务器出错');
        }); 
    }

    function refreshNavDOM() {
        if (M.userid < 0) {
            $('nav').addClass('no-user');
        } else {
            $('nav').removeClass('no-user');
        }
        $('.user').text(M.username);
    }


    function refreshNav() {
        ajax.get('/api/v1/whoami', {},
            function(data) {
                if (data.error) {
                    log('get user data failed: ' + data.msg);
                    infoDialog('错误', '从服务器获取信息失败，请重新刷新');
                    return;
                }

                M.userid = data.id;
                M.username = data.name;
                M.phone = data.phone;
                M.email = data.email;

                refreshNavDOM();
            },
            function(xhr, err) {
                log('get whoami failed');
            });
    }



    // refresh after having gotten the userid and username
    function refresh() {
        refreshNav();
        refreshBody();
    }

// Refresh DOM end -------------------------------


    refresh();

});
