var OPEN_HTTP_REQUESTS= 0;
var HTTP_REQUESTS     = {};
var NEXT_REQUEST_ID   = 1;

function xmlhttpPost(strURL, strParams, fun) {
    var timeout = 20000;
    //if (Math.random() > 0.5) timeout = 10;

    var self = { open : true, 
                 id   : NEXT_REQUEST_ID
               };
    HTTP_REQUESTS[NEXT_REQUEST_ID] = self;
    NEXT_REQUEST_ID++;

    // Mozilla/Safari        
    if (window.XMLHttpRequest) {
        self.xmlHttpReq = new XMLHttpRequest();
    }
    // IE
    else if (window.ActiveXObject) {
        self.xmlHttpReq = new ActiveXObject("Microsoft.XMLHTTP");
    }    

    self.xmlHttpReq.open('POST', strURL, true);

    var requestTimer = setTimeout(function() {
        if (self.id in HTTP_REQUESTS) {
            delete HTTP_REQUESTS[self.id];
            self.xmlHttpReq.abort();
            fun(null);
            OPEN_HTTP_REQUESTS--;
            // Handle timeout situation, e.g. Retry or inform user.
        }
    }, timeout);

    self.xmlHttpReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    self.xmlHttpReq.onreadystatechange = function() {
        if (self.xmlHttpReq.readyState == 4) {
            clearTimeout(requestTimer);
            if (self.id in HTTP_REQUESTS) {
                if (self.xmlHttpReq.status == 200) fun(self.xmlHttpReq.responseText);
                else                               fun(false);
                OPEN_HTTP_REQUESTS--;
                delete HTTP_REQUESTS[self.id];
            }
        }
    }

    OPEN_HTTP_REQUESTS++;
    self.xmlHttpReq.send(strParams);
}

function xmlhttpGet(strURL, strParams, fun) {
    var timeout = 20000;
    //if (Math.random() > 0.5) timeout = 10;
    
    var self = { open : true, 
                 id   : NEXT_REQUEST_ID
               };
    HTTP_REQUESTS[NEXT_REQUEST_ID] = self;
    NEXT_REQUEST_ID++;
    
    // Mozilla/Safari
    if (window.XMLHttpRequest) {
        self.xmlHttpReq = new XMLHttpRequest();
    }
    // IE
    else if (window.ActiveXObject) {
        self.xmlHttpReq = new ActiveXObject("Microsoft.XMLHTTP");
    }
    
    self.xmlHttpReq.open('GET', strURL, true);

    var requestTimer = setTimeout(function() {
        if (self.id in HTTP_REQUESTS) {
            delete HTTP_REQUESTS[self.id];
            self.xmlHttpReq.abort();
            fun(null);
            OPEN_HTTP_REQUESTS--;
            // Handle timeout situation, e.g. Retry or inform user.
        }
    }, timeout);

    self.xmlHttpReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    self.xmlHttpReq.onreadystatechange = function() {
        if (self.xmlHttpReq.readyState == 4) {
            clearTimeout(requestTimer);
            if (self.id in HTTP_REQUESTS) {
                if (self.xmlHttpReq.status == 200) fun(self.xmlHttpReq.responseText);
                else                               fun(false);
                OPEN_HTTP_REQUESTS--;
                delete HTTP_REQUESTS[self.id];
            }
        }
    }

    OPEN_HTTP_REQUESTS++;
    self.xmlHttpReq.send(strParams);
}

function isEmpty(obj) {
    for (var prop in obj) {
        if(obj.hasOwnProperty(prop)) return false;
    }
    return true;
}

function decode_utf8(bytes) {
    var len = bytes.length;
    var msg = "";

    if (len % 20 !== 0) {
        var zeroes = 20 - len % 20;
        for (var i=0; i < zeroes; i++) {
            bytes += String.fromCharCode(0);
        }
    }

    len = bytes.length;
    var chunks = [];
    var text = "";
    for (var k = 0; k < len; k++) {
        var c = bytes.charCodeAt(k); 
        text = text+bytes.charAt(k);
        
        if (k % 20 === 19) {
            chunks.push(text);
            text = "";
        }
    }

    var newlines = [];
    var buf = "";
    var has_newline = false;
    var is_null_terminated = false;
    var address_newlines = true; // When true, add newlines if needed.
    for (var j = 0; j < chunks.length; j++) {
        var sz = chunks[j].length;
        if (sz === 0) continue;

        var valid = true;
        var chunk = "";
        var chunk_has_newline = false;
        var chunk_is_null_terminated = false;
        
        for (var k = 0; k < sz; k++) {
            var c = chunks[j].charCodeAt(k);
            
            if (c <= 127
            &&  c !==  0
            &&  c !==  9 // horizontal tab
            &&  c !== 10 // new line
            &&  c !== 13 // carriage return
            &&  c !== 27 // 'ANSI Escape Sequence'
            &&  c <   32) {
                valid = false;
                break;
            }
            
            if (c === 10) chunk_has_newline = true;
            if (c === 0) {
                chunk_is_null_terminated = true;
                continue;
            }

            chunk_is_null_terminated = false;
            chunk = chunk + String.fromCharCode(c);
        }
        
        if (valid) {
            var buf2="";
            var buf_before = buf;
            buf = buf + chunk;
            var escaped = escape(buf);
            try {
                buf2 = decodeURIComponent(escaped);
            } catch (ex) {
                if (j+1 < chunks.length) {
                    // It is possible that this chunk ends in the middle of a
                    // multibyte UTF8 character. To see if it is true we will
                    // try decoding this chunk and the next chunk together.
                    // Since the next chunk could also end in the middle of
                    // a multibyte UTF8 character we will try omitting 1, 2 and
                    // 3 bytes from the end of the next chunk because an UTF8
                    // character can be as long as 4 bytes.
                    var ok = false;
                    var i = 0;
                    for (i=0; i<3; i++) {
                        var next_chunk = chunks[j+1];
                        next_chunk = next_chunk.substring(0, 20-i);
                        next_chunk = escape(next_chunk);
                        try {
                            buf2 = decodeURIComponent(escaped+next_chunk);
                        }
                        catch (ex2) {
                            continue;
                        }
                        ok = true;

                        // When multibyte UTF8 characters occupy 2 sequential
                        // 20-byte chunks we must not append newlines at the end
                        // of those 20-byte chunks.
                        address_newlines = false;
                        break;
                    }
                    
                    if (ok) {
                        // Current chunk alone was invalid but when we appended
                        // a part from the next chunk to it the result turned out
                        // to be a valid UTF8 string. Append the omitted characters
                        // to the beginning of the next chunk.
                        buf = buf_before + chunk + chunks[j+1].substring(0, 20-i);
                        if (i===0) chunks[j+1] = "";
                        else chunks[j+1] = chunks[j+1].substring(20-i, 20);
                    }
                }
                else buf2 = "";
            }
            if (buf2.length > 0) {
                msg = buf;
                if (chunk_has_newline) has_newline = true;
                is_null_terminated = chunk_is_null_terminated;
                newlines.push(msg.length);
            }
            else buf = buf_before;
        }
    }

    if (!has_newline && !is_null_terminated && address_newlines) {
        // If the last valid chunk did not end with a NULL byte then assume
        // each chunk to be on a separate line.
        var nsz = newlines.length;
        var add = 0;
        for (var k=0; k<nsz; k++) {
            var pos = newlines[k] + add;
            msg = [msg.slice(0, pos), "\n", msg.slice(pos)].join('');
            add++;
        }
    }

    msg = remove_colours(msg);

    try {
        msg = decodeURIComponent(escape(msg));
    } catch (ex) {
        msg = "";
    }    

    return msg;
}

function decode_ascii(bytes) {
    var text    = "";
    var chars   = 0;
    var valid   = 0;
    var visible = 0;
    var len     = bytes.length;
    var msg     = "";
    
    if (len % 20 !== 0) {
        var zeroes = 20 - len % 20;
        for (var i=0; i < zeroes; i++) {
            bytes += String.fromCharCode(0);
        }
    }

    for (var k = 0; k < len; k++) {
        var c = bytes.charCodeAt(k); 
        chars++;
        if (c === 0) {
            valid++;
        }
        else {
            if (c ===  9
            ||  c === 10
            ||  c === 13
            ||  c === 27
            || (c >=  32 && c <= 126)) {
                valid++;
                if (c >=  32 && c <= 126) {
                    visible++;
                }
                text = text+bytes.charAt(k);
            }
            else {
                text = text+"?";
            }
        }
        
        if (k % 20 === 19) {
            if (valid/chars > 0.9 && visible > 0) {
                msg = msg + text;
            }
            text    = "";
            chars   = 0;
            valid   = 0;
            visible = 0;
        }
    }
    
    return remove_colours(msg);
}

function remove_colours(bytes) {
    var len = bytes.length;
    var ansi= null;
    var buf = "";
    
    for (var k = 0; k < len; k++) {
        var c = bytes.charCodeAt(k);
        
        if (c === 27 && ansi === null) {
            ansi = k;
            continue;
        }
        else if (c === "m".charCodeAt(0) && ansi !== null) {
            ansi = null;
            continue;
        }

        if (ansi !== null && k-ansi+1 > 10) {
            k    = ansi;
            ansi = null;
            buf += String.fromCharCode(27);
            continue;
        }
        
        if (ansi === null) buf += String.fromCharCode(c);
    }
    
    return buf;
}

function isNormalInteger(str) {
    var n = ~~Number(str);
    return String(n) === str && n >= 0;
}

function isNumeric(value) {
    return /^\d+$/.test(value);
}

function isHex(hex) {
    if (hex.length % 2 !== 0) return false;
    var i = 0;
    var curCharCode = 0;
    hex = hex.toLowerCase();

    for (i=0, sz=hex.length; i<sz; i++) {
        curCharCode = hex.charCodeAt(i);

        if ((curCharCode>47 && curCharCode< 58)
        ||  (curCharCode>96 && curCharCode<103)) continue;

        return false;
    }

    return true;
}

function hex2ascii(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function ascii2hex(str) {
    var arr = [];
    for (var i = 0, l = str.length; i < l; i ++) {
        var hex = Number(str.charCodeAt(i)).toString(16);
        arr.push(hex.length < 2 ? "0"+hex : hex);
    }
    return arr.join('');
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp*1000);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()]; 
    var date = a.getDate();           date = pad(date, 2, '0');
    var hour = a.getHours();          hour = pad(hour, 2, '0');
    var min = a.getMinutes();         min  = pad(min,  2, '0');
    var sec = a.getSeconds();         sec  = pad(sec,  2, '0');
    var time = date + '. ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

function isOverflowed(element) {
    return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
}

/**
 * Count bytes in a string's UTF-8 representation.
 *
 * @param   string
 * @return  int
 */
function getByteLen(normal_val) {
    // Force string type
    normal_val = String(normal_val);

    var byteLen = 0;
    for (var i = 0; i < normal_val.length; i++) {
        var c = normal_val.charCodeAt(i);
        byteLen += c < (1 <<  7) ? 1 :
                   c < (1 << 11) ? 2 :
                   c < (1 << 16) ? 3 :
                   c < (1 << 21) ? 4 :
                   c < (1 << 26) ? 5 :
                   c < (1 << 31) ? 6 : Number.NaN;
    }
    return byteLen;
}

function checkRTL(s){
    var ltrChars        = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF'+'\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF',
        rtlChars        = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC',
        rtlDirCheck     = new RegExp('^[^'+ltrChars+']*['+rtlChars+']');

    return rtlDirCheck.test(s);
};

function is_string(val) {
    if (typeof val == 'string' || val instanceof String) return true;
    return false;
}

function Uint8ToString(u8a){
    var CHUNK_SZ = 0x8000;
    var c = [];
    for (var i=0; i < u8a.length; i+=CHUNK_SZ) {
        c.push(String.fromCharCode.apply(null, u8a.subarray(i, i+CHUNK_SZ)));
    }
    return c.join("");
}

function arrayBufferToWordArray(ab) {
  var i8a = new Uint8Array(ab);
  var a = [];
  for (var i = 0; i < i8a.length; i += 4) {
    a.push(i8a[i] << 24 | i8a[i + 1] << 16 | i8a[i + 2] << 8 | i8a[i + 3]);
  }
  return CryptoJS.lib.WordArray.create(a, i8a.length);
}

function selectText(containerid) {
    if (document.selection) {
        var range = document.body.createTextRange();
        range.moveToElementText(document.getElementById(containerid));
        range.select();
    } else if (window.getSelection) {
        var range = document.createRange();
        range.selectNode(document.getElementById(containerid));
        window.getSelection().addRange(range);
    }
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function is_blockchain_file(bytes) {
    // Returns the size of the file in case chunks contain a file. Returns zero
    // if bytes do not hold a file. A valid block chain file always ends with
    // zero padding to fill up the last 20-byte chunk. After that the next chunk
    // must be the RIPEMD-160 hash of the file (excluding the zero padding).

    // HACK:
    // Expect the file to end within the last 50 addresses. If it ends sooner,
    // this function returns 0 as a false negative. This hack is here because
    // ripemd160.clone().finalize() is way too slow and must be called as few
    // times as possible.

    var filesize = 0;
    var size=bytes.length;

    var start = new Date().getTime();
    if (size >= 40 && (size % 20) == 0) {
        var ripemd160 = CryptoJS.algo.RIPEMD160.create(); 
        var i = 0;
        while ((i+20) < size) {
            { 
                // HACK: Return when this function takes more than 250 ms to run.
                var end = new Date().getTime();
                var time = end - start;
                if (time > 250) return 0;
            }
            var j;
            var this_chunk = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
            var next_chunk = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

            var last_nonzero = 0;
            for (j=0; j<20; ++j) {
                this_chunk[j] = bytes.charCodeAt(i+j);
                if (this_chunk[j] != 0) last_nonzero = j;
            }
            var next_i = i+j;

            for (j=0; j<20; ++j) {
                next_chunk[j] = bytes.charCodeAt(next_i+j);
            }

            if (last_nonzero+1 == 20) {
                var wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(this_chunk));
                ripemd160.update(wordArray);
                var current_hash = null;
                if (i+1000 >= size) current_hash = ripemd160.clone().finalize().toString(CryptoJS.enc.Hex); // Last 50 addresses here.
                var expected_hash = CryptoJS.lib.WordArray.create(new Uint8Array(next_chunk)).toString(CryptoJS.enc.Hex);

                if (current_hash === expected_hash) {
                    filesize = next_i;
                }
            }
            else {
                var count = last_nonzero + 1;
                var iteration = 0;
                for (var first = 0; first < 20;) {
                    var arraybuf = [];
                    for (var k=0; k<count; ++k) {
                        arraybuf.push(this_chunk[first+k]);
                    }
                    var wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(arraybuf));
                    ripemd160.update(wordArray);
                    var current_hash = null;
                    if (i+1000 >= size) current_hash = ripemd160.clone().finalize().toString(CryptoJS.enc.Hex); // Last 50 addresses here.
                    var expected_hash = CryptoJS.lib.WordArray.create(new Uint8Array(next_chunk)).toString(CryptoJS.enc.Hex);

                    if (current_hash === expected_hash) {
                        filesize = i + first + count;
                    }

                    ++iteration;
                    first = last_nonzero + iteration;
                    count = 1;
                }
            }

            i = next_i;
        }
    }

    return filesize;
}

function formatBytes(bytes) {
         if (bytes <       1024) return bytes + " byt";
    else if (bytes <    1048576) return(bytes / 1024).toFixed(2) + " KiB";
    else if (bytes < 1073741824) return(bytes / 1048576).toFixed(2) + " MiB";
    else return (bytes / 1073741824).toFixed(2) + " GiB";
}

