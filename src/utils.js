var CG_UTILS_OPEN_HTTP_REQUESTS = 0;
var CG_UTILS_HTTP_REQUESTS      = {};
var CG_UTILS_NEXT_REQUEST_ID    = 1;

function xmlhttpPost(strURL, strParams, fun, timeout) {
    timeout = typeof timeout !== 'undefined' ? timeout : (20000);
    //if (Math.random() > 0.5) timeout = 10;

    var self = { open : true,
                 id   : CG_UTILS_NEXT_REQUEST_ID
               };
    CG_UTILS_HTTP_REQUESTS[CG_UTILS_NEXT_REQUEST_ID] = self;
    CG_UTILS_NEXT_REQUEST_ID++;

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
        if (self.id in CG_UTILS_HTTP_REQUESTS) {
            delete CG_UTILS_HTTP_REQUESTS[self.id];
            self.xmlHttpReq.abort();
            fun(null);
            CG_UTILS_OPEN_HTTP_REQUESTS--;
            // Handle timeout situation, e.g. Retry or inform user.
        }
    }, timeout);

    self.xmlHttpReq.setRequestHeader(
        'Content-Type', 'application/x-www-form-urlencoded'
    );

    self.xmlHttpReq.onreadystatechange = function() {
        if (self.xmlHttpReq.readyState == 4) {
            clearTimeout(requestTimer);
            if (self.id in CG_UTILS_HTTP_REQUESTS) {
                if (self.xmlHttpReq.status == 200) {
                    fun(self.xmlHttpReq.responseText);
                }
                else fun(false);
                CG_UTILS_OPEN_HTTP_REQUESTS--;
                delete CG_UTILS_HTTP_REQUESTS[self.id];
            }
        }
    }

    CG_UTILS_OPEN_HTTP_REQUESTS++;
    self.xmlHttpReq.send(strParams);
}

function xmlhttpGet(strURL, strParams, fun, timeout) {
    timeout = typeof timeout !== 'undefined' ? timeout : (20000);
    //if (Math.random() > 0.5) timeout = 10;

    var self = {
        open : true,
        id   : CG_UTILS_NEXT_REQUEST_ID
    };

    CG_UTILS_HTTP_REQUESTS[CG_UTILS_NEXT_REQUEST_ID] = self;
    CG_UTILS_NEXT_REQUEST_ID++;

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
        if (self.id in CG_UTILS_HTTP_REQUESTS) {
            delete CG_UTILS_HTTP_REQUESTS[self.id];
            self.xmlHttpReq.abort();
            fun(null);
            CG_UTILS_OPEN_HTTP_REQUESTS--;
            // Handle timeout situation, e.g. Retry or inform user.
        }
    }, timeout);

    self.xmlHttpReq.setRequestHeader(
        'Content-Type', 'application/x-www-form-urlencoded'
    );

    self.xmlHttpReq.onreadystatechange = function() {
        if (self.xmlHttpReq.readyState == 4) {
            clearTimeout(requestTimer);
            if (self.id in CG_UTILS_HTTP_REQUESTS) {
                if (self.xmlHttpReq.status == 200) {
                    fun(self.xmlHttpReq.responseText);
                }
                else fun(false);

                CG_UTILS_OPEN_HTTP_REQUESTS--;
                delete CG_UTILS_HTTP_REQUESTS[self.id];
            }
        }
    }

    CG_UTILS_OPEN_HTTP_REQUESTS++;
    self.xmlHttpReq.send(strParams);
}

function encode_base64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
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

function convert_timestamp(unix_timestamp) {
    var a = new Date(unix_timestamp*1000);
    var months = [
        'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
    ];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();           date = pad(date, 2, '0');
    var hour = a.getHours();          hour = pad(hour, 2, '0');
    var min = a.getMinutes();         min  = pad(min,  2, '0');
    var sec = a.getSeconds();         sec  = pad(sec,  2, '0');
    var time = (
        date + '. ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec
    );
    return time;
}

function get_timestamp_age(unix_timestamp) {
    return Math.floor(Date.now() / 1000) - unix_timestamp;
}

function isOverflowed(element) {
    return (
        element.scrollHeight > element.clientHeight ||
        element.scrollWidth  > element.clientWidth
    );
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

function formatBytes(bytes) {
         if (bytes <       1024) return (bytes/         1)            + " byt";
    else if (bytes <    1048576) return (bytes/      1024).toFixed(2) + " KiB";
    else if (bytes < 1073741824) return (bytes/   1048576).toFixed(2) + " MiB";
    else                         return (bytes/1073741824).toFixed(2) + " GiB";
}
