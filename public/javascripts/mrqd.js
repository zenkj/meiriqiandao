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
        currentHabit: -1,
        //currentDate: new Date(),
        moving: false,      // table is moving
        autoMoving: false,  // table is auto moving
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
    // @param date: specify the year and month of the table
    // @return a new date which is the first date of the table
    function firstDayOfTable(date) {
        var d = new Date(date.getFullYear(), date.getMonth(), 1);
        var delta = d.getDay() - 1;
        if (delta < 0) delta += 7;
        d.setDate(d.getDate() - delta);
        return d;
    }

    // update checkins in table
    function updateCheckins() {
        var i,j,k,n;
        var habit;
        var date = currentDate();
        date.setMonth(date.getMonth()-1);
        var dates = [];

        for (i=0; i<3; i++) {
            dates.push(firstDayOfTable(date));
            date.setMonth(date.getMonth()+1);
        }

        for (i=0; i<M.habits.length; i++) {
            if (T.currentHabit == M.habits[i].id) {
                habit = M.habits[i];
                break;
            }
        }

        var trs = $('.checkin-table tr');
        for (i=0; i<6; i++) {
            var $tr = $trs.eq(i+1);
            var $tds = $('td', $tr);
            for (j=0; j<3; j++) {
                for (k=0; k<7; k++) {
                    var $td = $tds.eq(j*7+k);
                    var y = dates[j].getFullYear();
                    var m = dates[j].getMonth();
                    var d = dates[j].getDate() - 1;
                    var weekday = dates[j].getDay();
                    weekday = weekday == 0 ? 7 : weekday;

                    var checkined = false;
                    if (habit && habit.checkins[y]) {
                        var checkin = habit.checkins[y][m];
                        if (checkin & (1<<d))
                            checkined = true;
                    }

                    if (checkined) {
                        $td.addClass('checkined');
                    } else {
                        $td.removeClass('checkined');
                    }

                    var workday = true;
                    if (habit) {
                        for (n=0; n<habit.workday.length; n++) {
                            if (weekday == habit.workday[n]) {
                                break;
                            }
                        }
                        if (n == habit.workday.length)
                            workday = false;
                    }
                    if (workday) {
                        $td.removeClass('rest-day');
                    } else {
                        $td.addClass('rest-day');
                    }

                    dates[j].setDate(dates[j].getDate()+1);
                }
            }
        }
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

    // Get or set current habbit
    function currentHabit(hid) {
        if (typeof hid == 'undefined') {
            return T.currentHibit;
        } else {
            var i;

            if (hid == T.currentHibit)
                return;

            for (i=0; i<M.habits.length; i++) {
                if (hid == M.habits[i].id)
                    break;
            }

            T.currentHibit = i==M.habits.length ? -1 : hid;
            updateCheckins();
        }
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
    function gotoDate(date) {
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
                        dates[j].setDate(dates[j].getDate()+1);
                    }
                }
            }
            $('.checkin-table').css('left', '-100%');
        }

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

    $('.return-today').click(function() {
        gotoDate(new Date());
    });
// Adjust Date End---------------------------

// Dialog Begin-------------------------------
    var Dialog = (function() {
        var okcbs = [];
        var yescbs = [];
        var nocbs = [];

        $('.dialog-button-ok').click(function(e) {
            e.stopPropagation();
            $.each(okcbs, function(i, cb) {cb();});
            okcbs = [];
            $('.dialog-container').removeClass('display');
        });

        $('.dialog-button-yes').click(function(e) {
            e.stopPropagation();
            $.each(yescbs, function(i, cb) {cb();});
            yescbs = [];
            $('.dialog-container').removeClass('display');
        });

        $('.dialog-button-no').click(function(e) {
            e.stopPropagation();
            $.each(nocbs, function(i, cb) {cb();});
            nocbs = [];
            $('.dialog-container').removeClass('display');
        });

        $('.dialog-background').click(function(e) {
            e.stopPropagation();
            $.each(okcbs, function(i, cb) {cb();});
            $.each(nocbs, function(i, cb) {cb();});
            okcbs = [];
            nocbs = [];
            $('.dialog-container').removeClass('display');
        });

        function info(title, msg, cb) {
            $('.dialog-info .dialog-title').text(title || '');
            $('.dialog-info .dialog-message').text(msg || '');
            $('.dialog').removeClass('display');
            $('.dialog-container, .dialog-info').addClass('display');
            if (cb) okcbs.push(cb);
        }

        function yesno(title, msg, yescb, nocb) {
            $('.dialog-yesno .dialog-title').text(title || '');
            $('.dialog-yesno .dialog-message').text(msg || '');
            $('.dialog').removeClass('display');
            $('.dialog-container, .dialog-yesno').addClass('display');

            if (yescb) yescbs.push(yescb);
            if (nocb) nocbs.push(nocb);
        }

        return {
            info: info,
            yesno: yesno,
        };
    })();

    Dialog.info('this is title', 'hello world', function() {log('end');});
// Dialog End---------------------------------



// Register Listeners Begin ---------------------
    $('.checkin-table td').each(function(i) {
        var hc = new Hammer(this);
        hc.on('tap', function(e) {
            $(e.target).toggleClass('checkined');
        });
    });



    $('.checkin-table').each(function() {
        var hc = new Hammer(this);
        var swiped = false;
        var $table = $(this);
        var $container = $table.parent();
        var startLeft = 0;

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
            autoMoveTo(1);
        });
        hc.on('swiperight', function(e) {
            log('swipe right');
            if (T.autoMoving) return;
            swiped = true;
            autoMoveTo(-1);
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

            autoMoveTo(deltaMonth);
        });

        // deltaMonth can only be -1, 0, or 1
        // means auto move to prev month, current month, or next month
        function autoMoveTo(deltaMonth) {
            var date = currentDate();
            date.setMonth(date.getMonth()+deltaMonth);
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

    });
// Register Listeners End ------------------------


    function init() {
        ajax.get('/api/v1/checkins', null,
                 function(data) {
                    if (!data || data.error) {
                        log('get checkins error: ' + data.msg);
                        return;
                    }
                    G.version = data.version;
                    G.habits = data.habits;
                    if (G.habits.length > 0) {
                        T.currentHabit = G.habits[0].id;
                    }
                 },
                 function(xhr, err) {
                 }); 
    }

});
