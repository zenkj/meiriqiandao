$(document).ready(function() {

// Global Data Begin-------------------------------
    // model data
    var M = {
        userid: -1,
        username: '签到君',
        email: '',
        phone: '',
        version: -1,
        habits: [],
    };

    // temporary data
    var T = {
        currentHabit: null,
        //currentDate: new Date(),
        moving: false,      // table is moving
        autoMoving: false,  // table is auto moving
        waitingCheckins: {},
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
    function checkin(date, state) {
        var i;
        var habit = T.currentHabit;

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

    function isWorkDay(date) {
        var i;
        var habit = T.currentHabit;
        if (!habit) return true;
        var weekday = date.getDay();
        weekday = weekday == 0 ? 7 : weekday;
        return !!(habit.workday & (1<<weekday));
    }

    // update one checkin in table according to the habit setting
    function updateCheckin($td, date) {
        var checkined = checkin(date);

        if (checkined) {
            $td.addClass('checkined');
        } else {
            $td.removeClass('checkined');
        }

        var workday = isWorkDay(date);
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


    function updateHabit(habit) {
        $('.checkin-count', habit.dom).text(checkinCount(habit));
        if (habit == T.currentHabit) {
            $(habit.dom).addClass('active');
        } else {
            $(habit.dom).removeClass('active');
        }
    }

    // update habits in habit list
    // @param refresh: true: the model is changed, recreate related dom object
    //                 false: the model is not changed, reuse the dom object
    function updateHabits(refresh) {
        var i, habit, $habit;
        $list = $('#habit-list');

        if (refresh) $list.empty();

        for (i=0; i<M.habits.length; i++) {
            habit = M.habits[i];
            if (refresh) {
                $habit = $('<li></li>');
                $habit.data('model', habit);
                habit.dom = $habit[0];
                $habit.addClass('habit list-group-item');
                $habit.text(habit.name);
                $habit.append('<span class="badge checkin-count"></span>');
                $habit.appendTo($list);
                new Hammer($habit[0]).on('tap', function(e) {
                    var $target = $(e.target);
                    T.currentHabit = $target.data('model') || $target.parent().data('model');
                    updateHabits();
                });
            }
            updateHabit(habit);
        }

        updateCheckins();
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
            return T.currentHibit;
        } else {
            T.currentHibit = habit;
            updateHabits();
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
            for (var i=0; i<M.habits.length; i++) {
                if (M.habits[i].id == hid) {
                    return M.habits[i];
                }
            }
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
    // td can be destination month or number offset to the current month 
    function slideTo(td) {
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
            if (date.getFullYear() == today.getFullYear() &&
                date.getMonth() == today.getMonth()) {
                $('.return-today').removeClass('display');
            } else {
                $('.return-today').addClass('display');
            }
        }

        var td, cd = currentDate();
        cd.setDate(1);

        var deltaMonth = 0;

        if (typeof td == 'number') {
            cd.setMonth(cd.getMonth()+td);
            if (td <-1 || td >1) {
                gotoDate(cd);
                return;
            }
            deltaMonth = td;
            td = cd;
        } else {
            td.setDate(1);
            var prev = new Date(cd.getTime());
            var next = new Date(cd.getTime());
            prev.setMonth(prev.getMonth()-1);
            next.setMonth(next.getMonth()+1);
            if (sameMonth(cd, td)) {
                deltaMonth = 0;
            } else if (sameMonth(next, td)) {
                deltaMonth = 1;
            } else if (sameMonth(prev, td)) {
                deltaMonth = -1;
            } else {
                gotoDate(td);
                return;
            }
        }

        // deltaMonth can only be -1, 0, or 1
        // means auto move to prev month, current month, or next month
        var $table = $('.checkin-table');
        var $container = $table.parent();
        var date = td;
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
            var checkined = checkin(date);

            if ($td.hasClass('wait-server-response')) {
                log('the server do not answer me:-(');
                return;
            }

            if (M.userid < 0) {
                // dummy user
                checkin(date, !checkined);
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
                                    checkin(date, !checkined);
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


    $('#button-new-habit').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
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

                if (data.version == M.version+1 && data.habit) {
                    M.version += 1;
                    M.habits.unshift(data.habit);
                    T.currentHabit = data.habit;
                    updateHabits(true);
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
    });


    $('#dialog-user-config').on('show.bs.modal', function() {
        $('#user-config-name').val(M.username);
        $('#user-config-phone').val(M.phone);
        $('#user-config-email').val(M.email);
    });

    $('#button-user-config').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
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
                email, email,
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
    });


// Register Listeners End ------------------------


    // refresh view after big model changed (from MVC perspective)
    function refreshView() {
        var i;
        if (M.habits.length > 0) {
            if (!T.currentHabit) {
                T.currentHabit = M.habits[0];
            } else {
                for (i=0; i<M.habits.length; i++) {
                    if (T.currentHabit.id == M.habits[i].id) {
                        T.currentHabit = M.habits[i];
                        break;
                    }
                }
                if (i == M.habits.length)
                    T.currentHabit = M.habits[0];
            }
        } else {
            T.currentHabit = null;
        }

        updateHabits(true);
    }

    function refresNav() {
        if (M.userid < 0) {
            $('nav').addClass('no-user');
        } else {
            $('nav').removeClass('no-user');
        }
        $('.user').text(M.username);
    }

    // refresh after having gotten the userid and username
    function refresh() {
        refreshNav();
        ajax.get('/api/v1/checkins', {version: M.version},
                 function(data) {
                    var i;
                    if (data.error) {
                        log('get checkins error: ' + data.msg);
                        infoDialog('提示', '从服务器获取信息失败，请重新刷新');
                        return;
                    }
                    if (M.userid == data.uid && M.version == data.version) {
                        log('no data changed on server, every thing is ok');
                        return;
                    }
                    M.userid = data.uid;
                    M.username = data.uname;
                    M.version = data.version;
                    M.habits = data.habits;
                    refreshView();
                 },
                 function(xhr, err) {
                    log('get checkin data failed');
                 }); 
    }

    refresh();
});
