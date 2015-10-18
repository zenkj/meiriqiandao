$(document).ready(function() {

// Global Data Begin-------------------------------
    // model data
    var M = {
        userid: 0,
        username: '',
        version: 0,
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
        var workday = true;
        for (i=0; i<habit.workday.length; i++) {
            if (weekday == habit.workday[i]) {
                break;
            }
        }
        if (i == habit.workday.length)
            workday = false;
        return workday;
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

// Dialog Begin-------------------------------
    var Dialog = (function() {
        var okcb;
        var yescb;
        var nocb;

        $('.dialog-button-ok').click(function(e) {
            e.stopPropagation();
            if (okcb) okcb();
            okcb = null;
            $('.dialog-container').removeClass('display');
        });

        $('.dialog-button-yes').click(function(e) {
            e.stopPropagation();
            if (yescb) yescb();
            yescb = null;
            $('.dialog-container').removeClass('display');
        });

        $('.dialog-button-no').click(function(e) {
            e.stopPropagation();
            if(nocb) nocb();
            nocb = null;
            $('.dialog-container').removeClass('display');
        });

        $('.dialog-background').each(function(){
            var hc = new Hammer(this);
            hc.on('tap', function() {
                if (okcb) okcb();
                if (nocb) nocb();
                okcb = null;
                nocb = null;
                $('.dialog-container').removeClass('display');
            });
        });

        function info(title, msg, cb) {
            $('.dialog-info .dialog-title').text(title || '');
            $('.dialog-info .dialog-message').text(msg || '');
            $('.dialog').removeClass('display');
            $('.dialog-container, .dialog-info').addClass('display');
            okcb = cb;
        }

        function yesno(title, msg, ycb, ncb) {
            $('.dialog-yesno .dialog-title').text(title || '');
            $('.dialog-yesno .dialog-message').text(msg || '');
            $('.dialog').removeClass('display');
            $('.dialog-container, .dialog-yesno').addClass('display');

            yescb = ycb;
            nocb = ncb;
        }

        function signup(ycb, ncb) {
            $('.dialog').removeClass('display');
            $('.dialog-container, .dialog-signup').addClass('display');
            yescb = ycb;
            nocb = ncb;
        }

        function login(ycb, ncb) {
            $('.dialog').removeClass('display');
            $('.dialog-container, .dialog-login').addClass('display');
            yescb = ycb;
            nocb = ncb;
        }

        return {
            info: info,
            yesno: yesno,
            signup: signup,
            login: login,
        };
    })();

    //Dialog.info('每日签到 - 养成好习惯', '欢迎欢迎', function() {log('end');});
// Dialog End---------------------------------



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
                Dialog.info('提醒', '请先创建一个习惯');
                return;
            }

            if (!T.currentHabit) {
                Dialog.info('提醒', '请选择一个习惯');
                return;
            }

            var td = e.target;
            var $td = $(td);
            if (!td.tposition) {
                log('td not in current table segment is clicked');
                return;
            }


            var date = firstDayOfTable();
            date.setDate(date.getDate()+td.tposition-1);
            var checkined = checkin(date);

            if ($td.hasClass('wait-server-response')) {
                log('the server do not answer me:-(');
                return;
            }

            if (M.userid == 0) {
                // dummy user
                checkin(date, !checkined);
                updateHabit(T.currentHabit);
                updateCheckin($td, date);
            } else {
                ajax.put('/api/v1/checkins/'+checkinID(T.currentHabit, date),
                        {version: M.version, checkin: !checkined},
                        function(data) {
                            waitingServerCheckin(T.currentHabit, date, 'remove');
                            if (data.error) {
                                log('update checkin error: ' + data.msg);
                                updateCheckins();
                            } else {
                                if (data.version == M.version + 1) {
                                    // everything is ok
                                    M.version = data.version;
                                    checkin(date, !checkined);
                                    updateCheckins();
                                } else {
                                    // someone else has updated elsewhere
                                    M.version = data.version;
                                    M.habits = data.habits;
                                    refreshView();
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
                $td[0].tposition = k++;
                hc = new Hammer($td[0]);
                hc.on('tap', toggleCheckin);
            }
        }

    });


    $('#to-signup').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            var $login = $('#dialog-login');
            $login.modal('hide');
            $login.one('hidden.bs.modal', function() {
                var $signup = $('#dialog-signup');
                $signup.modal('show');
            });
        });
    });

    $('#to-login').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            var $signup = $('#dialog-signup');
            $signup.modal('hide');
            $signup.one('hidden.bs.modal', function() {
                var $login = $('#dialog-login');
                $login.modal('show');
            });
        });
    });

    $('#button-signup').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            var $dialog = $('#dialog-signup');
            var phone = $('#signup-phone').val();
            var email = $('#signup-email').val();
            var password1 = $('#signup-password').val();
            var password2 = $('#signup-password-again').val();
            ajax.post('/signup', {
                phone: phone,
                email: email,
                password: password1,
            }, function(data) {
                $dialog.modal('hide');
            }, function(xhr, err) {
            });
        });
    });

    $('#button-login').each(function() {
        var hc = new Hammer(this);
        hc.on('tap', function() {
            var $dialog = $('#dialog-login');
            var user = $('#login-user').val();
            var password = $('#login-password').val();
            ajax.post('/login', {
                user: user,
                password: password,
            }, function(data) {
            }, function(xhr, err) {
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

    function refresh() {
        ajax.get('/api/v1/checkins', {version: M.version},
                 function(data) {
                    var i;
                    if (!data || data.error) {
                        log('get checkins error: ' + data.msg);
                        return;
                    }
                    if (M.userid == data.uid && M.version == data.version) {
                        log('no data changed on server, every thing is ok');
                        return;
                    }
                    M.userid = data.uid;
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
