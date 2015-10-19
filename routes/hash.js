var crypto = require('crypto');

function hash(data) {
    var sha = crypto.createHash('sha1');
    sha.update(data);
    return sha.digest('base64');
}

module.exports = {hash: hash};

