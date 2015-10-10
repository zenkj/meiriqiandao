$(document).ready(function() {
    $('td').each(function(i) {
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

        hc.on('swipeleft', function(e) {
            //console.log('hello swipe left');
            if (autoMoving) return;
            swiped = true;
            autoMoveTo(1);
        });
        hc.on('swiperight', function(e) {
            //console.log('hello swipe right');
            if (autoMoving) return;
            swiped = true;
            autoMoveTo(-1);
        });
        hc.on('panstart', function(e) {
            //console.log('hello panstart');
            if (autoMoving) return;
            swiped = false;
            startLeft = $('.checkin-table').position().left;
        });
        hc.on('panmove', function(e) {
            //console.log('hello panmove');
            if (autoMoving) return;
            var left = startLeft + e.deltaX;
            var width = $table.outerWidth() / 3.0;
            if (left <= 0 && left >= -2*width) {
                $table.css('left', ''+left+'px');
            }
        });

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

        hc.on('panend', function(e) {
            //console.log('hello panend');
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
                $table.on('transitionend', function() {
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

});
