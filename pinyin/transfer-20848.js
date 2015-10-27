var zi2py = require('./dict-20848');

var ph = require('./phonetic-symbol');

var k,v,vs;
var ph1 = {};
for (k in ph) {
    ph1[k] = ph[k][0];
}

var phre = new RegExp(Object.keys(ph1).join('|'), 'g');

var py2zi = {};
var zis;

var i,j;

for (k in zi2py) {
    vs = zi2py[k].replace(phre, function(match){return ph1[match];}).split(',');
    for (i=0; i<vs.length; i++) {
        // remove empty pinyin
        if (vs[i].length == 0) continue;
        zis = py2zi[vs[i]];
        if (!zis) {
            zis = py2zi[vs[i]] = {};
        }

        zis[k] = true;
        // only use the first pinyin(most common)
        break;
    }
}

var pys = Object.keys(py2zi);

pys.sort();

var output = [];
for (i=0; i<pys.length; i++) {
    zis = Object.keys(py2zi[pys[i]]).join('');
    output.push(pys[i]+':' + zis);
}
var outputstr = output.join(',');

output = [];
j=0;
var begin = 0;
for (i=0; i<outputstr.length; i++) {
    if (outputstr.charCodeAt(i) < 128)
        j++;
    else
        j+=2;
    if (j>=60) {
        output.push("'"+outputstr.substring(begin, i)+"',");
        begin = i;
        j=0;
    }
}
output.push("'"+outputstr.substring(begin, outputstr.length)+"'");

outputstr = output.join('\n    ');
console.log('(function() {');
console.log('    var py2zi0 = [')
console.log('    ' + outputstr + '];');


function calculateCount() {
    var zimap = {};
    var i;
    for (i=0; i<pys.length; i++) {
        zis = Object.keys(py2zi[pys[i]]).join('');
        for (j=0; j<zis.length; j++) {
            zimap[zis[j]] = true;
        }
    }
    
    console.log(Object.keys(zimap).length); // 20848
}
