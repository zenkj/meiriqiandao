var db = require('mysql');

var conn = db.createConnection({
    host: '127.0.0.1',
    user: 'mrqd',
    password: 'mrqd123',
    database: 'mrqd',
});

conn.query("update users set name='aaa',phone='18666292624',email=null where id=1", function(err, rows) {
    if (err) {
        console.log(err);
        conn.end();
        return;
    }

    console.log('total ' + rows.length + ' rows');
    console.log('insertId is ' + rows.insertId);

    for (var i=0; i<rows.length; i++) {
        console.log(rows[i]);
    }

    conn.end();
});
