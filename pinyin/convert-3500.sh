#!/bin/sh

FILE=txpinyin-3500.js
node transfer-3500.js >$FILE
cat >>$FILE <<EOF

    var zi2py = {};
    var py2zi1;
    var pz,i,j;
    
    py2zi1 = py2zi0.join('').split(',');
    for (i=0; i<py2zi1.length; i++) {
        pz = py2zi1[i].split(':');
        for (j=0; j<pz[1].length; j++) {
            zi2py[pz[1][j]] = pz[0];
        }
    }
    
    function pinyin(str) {
        var pys = [], shengmus = [], poss = [];
        var py, ch, pos=0;
        var i;
    
        if (typeof str != 'string')
            return {hasHanzi: false};
        for (i=0; i<str.length; i++) {
            poss.push(pos);
            ch = str[i];
            py = zi2py[ch];
            if (py) {
                pys.push(py);
                shengmus.push(py[0]);
                pos += py.length;
            } else {
                pys.push(ch);
                shengmus.push(ch);
                pos++;
            }
        }
    
        if (pys.length > 0) {
            return {
                hasHanzi: true,
                pinyin: pys.join(''),
                acronym: shengmus.join(''),
                pos: poss,
            };
        } else {
            return {hasHanzi: false};
        }
    }
    
    if (typeof window != 'undefined') {
        window.txpinyin = pinyin;
    } else if (typeof module != 'undefined') {
        module.exports = pinyin;
    }

})();
EOF

