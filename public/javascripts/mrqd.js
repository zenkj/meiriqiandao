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
        currentHabit: 0,
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
// Utilities End---------------------------------



    $('.checkin-table td').each(function(i) {
        var hc = new Hammer(this);
        hc.on('tap', function(e) {
            $(e.target).toggleClass('checkined');
        });
    });



    $('.checkin-table').each(function() {
        var hc = new Hammer(this);
        var swiped = false;
        var autoMoving = false;
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
            if (autoMoving) return;
            swiped = true;
            autoMoveTo(1);
        });
        hc.on('swiperight', function(e) {
            log('swipe right');
            if (autoMoving) return;
            swiped = true;
            autoMoveTo(-1);
        });
        hc.on('panstart', function(e) {
            log('panstart: deltaX='+e.deltaX);
            if (autoMoving) return;
            swiped = false;
            startLeft = $('.checkin-table').position().left;
        });
        hc.on('panmove', function(e) {
            log('panmove: deltaX=' + e.deltaX);
            if (autoMoving) return;
            var left = startLeft + e.deltaX;
            var width = $table.outerWidth() / 3.0;
            if (left <= 0 && left >= -2*width) {
                $table.css('left', ''+left+'px');
            }
        });

        hc.on('panend', function(e) {
            log('panend: deltaX='+ e.deltaX);
            if (autoMoving) return;
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
                resetTable(date);
                return;
            } else {
                $table.addClass('auto-move');
                $table.css('left', ''+destLeft+'px');
                autoMoving = true;

                // weixin X5 engine need webkitTransitionEnd
                $table.one('webkitTransitionEnd oTransitionEnd otransitionend transitionend', function() {
                    log('transition end');
                    $table.removeClass('auto-move');
                    autoMoving = false;
                    resetTable(date);
                });
            }
        }

        // update checkin table
        // adjust the table position, center it
        function resetTable(date) {
            var time = date.getTime();
            var dates = [new Date(time), new Date(time), new Date(time)];
            var months = [];
            dates.forEach(function(d, i) {
                d.setMonth(d.getMonth()+i-1);
                d.setDate(1);
                months[i] = d.getMonth();
                var day = d.getDay() - 1;
                day = day < 0 ? day + 7 : day;
                d.setDate(d.getDate() - day);
            });
            var $trs = $('.checkin-table tr');
            for (var i=0; i<6; i++) {
                var $tr = $trs.eq(i+1);
                var $tds = $('td', $tr);
                for (var j=0; j<3; j++) {
                    for (var k=0; k<7; k++) {
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
            $table.css('left', '-100%');
            currentDate(date);
        }
    });


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

        function delete(url, data, done, fail) {
            request('DELETE', url, data, done, fail);
        }

        return {
            get: get,
            post: post,
            put: put,
            delete: delete,
        };
    })();

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
