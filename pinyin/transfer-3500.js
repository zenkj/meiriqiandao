var zi = require('./dict-3500');
var ph = require('./phonetic-symbol');

var k;
var ph1 = {};
for (k in ph) {
    ph1[k] = ph[k][0];
}

var phre = new RegExp(Object.keys(ph1).join('|'), 'g');

var zi1 = {};

var ks;
var v;
var vs;

var i,j;
var map = {};
for (k in zi) {
    v = zi[k];
    ks = k.replace(phre, function(match) {return ph1[match];}).split(',');
    for (i=0; i<ks.length; i++) {
        if (ks[i].length == 0) continue;
        vs = map[ks[i]];
        if (!vs) {
            vs = map[ks[i]] = {};
        }

        for (j=0; j<v.length; j++) {
            vs[v[j]] = true;
        }
    }
}

var map1 = {};

for (k in map) {
    map1[k] = Object.keys(map[k]).join('');
}

ks = Object.keys(map1);
ks.sort();


var mapzi = {}, mapzi1 = {};
var output = [], outputstr;

function testOutput() {
    output.push('module.exports = {');
    for (i=0; i<ks.length; i++) {
        output.push('  "' + ks[i] + '": "' + map1[ks[i]] + '",');
        v = map1[ks[i]];
        for (j=0; j<v.length; j++) {
            mapzi[v[j]] = true;
        }
    }
    output.push('};');
    outputstr = output.join('\n');
    //console.log(outputstr);
    //return;
    
    
    output = [];
    output.push('module.exports = {');
    for (i=0; i<ks.length; i++) {
        output.push('"' + ks[i] + '":"' + map1[ks[i]] + '",');
        v = map1[ks[i]];
        for (j=0; j<v.length; j++) {
            mapzi[v[j]] = true;
        }
    }
    output.push('};');
    outputstr = output.join('');
    //console.log(outputstr);
    //return
    
    output = [];
    for (i=0; i<ks.length; i++) {
        output.push(ks[i] + ':' + map1[ks[i]]);
        v = map1[ks[i]];
        for (j=0; j<v.length; j++) {
            mapzi[v[j]] = true;
        }
    }
    outputstr = output.join(',');
    //console.log(outputstr);
    //return
}


output = [];
for (i=0; i<ks.length; i++) {
    output.push(ks[i] + ':' + map1[ks[i]]);
    v = map1[ks[i]];
    for (j=0; j<v.length; j++) {
        mapzi[v[j]] = true;
    }
}
outputstr = output.join(',');
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




function count() {
    console.log('total zi: ' + Object.keys(mapzi).length);
    
    for (k in zi) {
        v = zi[k];
        for (i=0; i<v.length; i++) {
            mapzi1[v[i]] = true;
        }
    }
    
    console.log('total zi: ' + Object.keys(mapzi1).length);
}

function minCode() {
    var min = 1000000000;
    for (k in mapzi1) {
        if (k.charCodeAt(0) < min)
            min = k.charCodeAt(0);
    }

    console.log('minimum is ' + min);
}
