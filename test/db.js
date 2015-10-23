var db = require('mysql');

var conn = db.createConnection({
    host: '127.0.0.1',
    user: 'mrqd',
    password: 'mrqd123',
    database: 'mrqd',
});

conn.query('select * from habits', function(err, rows) {
//conn.query("delete from habits where id=1 and uid=1", function(err, rows) {
//conn.query("select flag%2 as enabled, count(uid) as count from habits where uid=-1 group by enabled", function(err, rows) {
//conn.query("update habits set name='hell\\\'o' where id=2", function(err, rows) {
//conn.query("update users set name='aaa',phone='18666292624',email=null where id=1", function(err, rows) {
    if (err) {
        console.log(err);
        conn.end();
        return;
    }

    console.log('rows ' + rows);
    console.log('total ' + rows.length + ' rows');
    console.log('insertId is ' + rows.insertId);

    for (var i=0; i<rows.length; i++) {
        console.log(rows[i]);
    }

    for (var k in rows) {
        console.log('k = ' + k + ', v = ' + rows[k]);
    }

    conn.end();
});
