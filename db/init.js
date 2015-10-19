var db = require('mysql');

var conn = db.createConnection({
    host: '127.0.0.1',
    user: 'mrqd',
    password: 'mrqd123',
    database: 'mrqd',
});

conn.query("select * from users where email = ?", ['aa@b.c'], function(err, rows) {
    if (err) {
        console.log(err);
        conn.end();
        return;
    }

    console.log('total ' + rows.length + ' rows');

    for (var i=0; i<rows.length; i++) {
        console.log(rows[i]);
    }

    conn.end();
});
