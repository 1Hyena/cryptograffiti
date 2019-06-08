<?php

// ERROR TYPES:
define("ERROR_CRITICAL",            "ERROR_CRITICAL"           ); // should never happen, affects critical infrastructure
define("ERROR_INTERNAL",            "ERROR_INTERNAL"           ); // should never happen
define("ERROR_TABLE_ASSURANCE",     "ERROR_TABLE_ASSURANCE"    ); // should never happen
define("ERROR_DATABASE_CONNECTION", "ERROR_DATABASE_CONNECTION"); // should never happen
define("ERROR_SQL",                 "ERROR_SQL"                ); // should never happen
define("ERROR_NO_CHANGE",           "ERROR_NO_CHANGE"          ); // can rarely occur but not repeatedly
define("ERROR_INVALID_ARGUMENTS",   "ERROR_INVALID_ARGUMENTS"  ); // invalid request
define("ERROR_MISUSE",              "ERROR_MISUSE"             ); // invalid request
define("ERROR_NONCE",               "ERROR_NONCE"              ); // unexpected nonce, possible MITM Attack attempt
define("ERROR_ACCESS_DENIED",       "ERROR_ACCESS_DENIED"      ); // banned or invalid IP address

// GAME CONSTANTS:
define("API_VERSION",                                     "1.0"); // Version identifier for this particular implementation of the API.
define("SATOSHIS_PER_BITCOIN",                        100000000); // All bitcoin amounts are converted to integers known as satoshis.
define("BTC_ADDRESS",      "1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS"); // Server's bitcoin address used to deposit bitcoins.
define("STATS_PER_QUERY",                                    50); // Maximum number of stats rows to be returned as a response to `get_stats`.
define("LOGS_PER_QUERY",                                     50); // Maximum number of log rows to be returned as a response to `get_log`.
define("ORDERS_PER_QUERY",                                   50); // Maximum number of order rows to be returned as a response to `get_*_orders`.
define("SESSION_TIMEOUT",                                    30); // Number of seconds for the session to timeout.
define("CAPTCHA_TIMEOUT",                                   600); // Number of seconds unused captchas are kept in the database.
define("MAX_DATA_SIZE",                                  262144); // Maximum number of uncompressed and unencrypted data bytes accepted as valid input.
define("TXS_PER_QUERY",                                    1000); // Maximum number of transactions to be dealt with per single API call.
define("ROWS_PER_QUERY",                                   1000); // Maximum number of rows to be dealt with per single API call.
define("MIN_BTC_DONATION",                                    1); // Minimum number of satoshis that count for a donation.
define("MIN_BTC_OUTPUT",                                    546); // Minimum number of satoshis per TX output.
define("ENCODER_FEE_AMPLIFIER",                             1.0); // Amplifier for the estimatefee results.

// SECURITY ROLES:
define("ROLE_DECODER",                                        1); // Decoder (Can submit transactions containing plaintext.)
define("ROLE_MONITOR",                                        2); // Monitor (Has access to server logs.)
define("ROLE_EXECUTIVE",                                      4); // Executive (Can accept and fill orders.)
define("ROLE_ENCODER",                                        8); // Encoder (Responsible for saving messages into block chain.)

// SESSION FLAGS:
define("FLAG_CRITICAL",                                       1); // TRUE for sessions that must always be online.
define("FLAG_FUSED",                                          2); // TRUE when the session has been offline for some time already.
define("FLAG_PARALYZED",                                      4); // TRUE for sessions in quarantine so that they couldn't interact with the DB.

// LOG IMPORTANCE LEVELS:
define("LOG_MINOR",                                           0);
define("LOG_NORMAL",                                          1);
define("LOG_MISUSE",                                          2);
define("LOG_FINANCIAL",                                       3);
define("LOG_ERROR",                                           4);
define("LOG_CRITICAL",                                        5);

// Load authentication variables from a file in server instead of having them hardcoded here.
// This is needed because SVN repository might leak and then we don't want rogue developers or
// some hackers to immediately have access to our critical infrastructure:
require('./auth.php');

function make_error($code, $message, $parent_file_name = null, $parent_file_line = null) {
    if ($parent_file_name === null
    ||  $parent_file_line === null) {
        $bt     = debug_backtrace();
        $caller = array_shift($bt);

        $file      = $caller['file'];
        $info      = pathinfo($file);
        $file_name = basename($file,'.'.$info['extension']);
        $line      = $caller['line'];
    }
    else {
        $file_name = $parent_file_name;
        $line      = $parent_file_line;
    }

    $error = array();
    $error['message'] = $message;
    $error['file']    = $file_name;
    $error['line']    = $line;
    $error['code']    = $code;

    return $error;
}

function set_critical_error($link, $msg = '') {
    $bt     = debug_backtrace();
    $caller = array_shift($bt);
    $line   = $caller['line'];

    if (get_stat($link, 'last_error') != $line) {
        db_log($link, null, 'Critical error on line '.$line.'. '.$msg, LOG_CRITICAL);
    }

    set_stat($link, "last_error", $line);
}

function make_result($result) {
          if ($result === false) return 'FAILURE';
     else if ($result ===  true) return 'SUCCESS';
     else return 'UNKNOWN';
}

function make_failure($code, $message, $vars = array()) {
    $bt     = debug_backtrace();
    $caller = array_shift($bt);

    $file      = $caller['file'];
    $info      = pathinfo($file);
    $file_name = basename($file,'.'.$info['extension']);
    $line      = $caller['line'];

    $vars['result'] = make_result(false);
    $vars['error']  = make_error($code, $message, $file_name, $line);

    return $vars;
}

function make_success($data = array()) {
    if (is_array($data) && count($data) > 0) {
        $data['result'] = make_result(true);
        return $data;
    }
    return array('result' => make_result(true));
}

function init_sql() {
    $host     = SQL_HOST;
    $username = SQL_USERNAME;
    $password = SQL_PASSWORD;
    $db_name  = SQL_DATABASE;

    // Connect to server and select databse.
    $link = new mysqli($host, $username, $password, $db_name);
    if ($link->connect_error) return false;
    return $link;
}

function deinit_sql($link) {
    $link->close();
}

function is_num($var) {
    if (!is_string($var)) return false;
    if (strlen($var) === 0) return false;
    for ($i=0;$i<strlen($var);$i++) {
        $ascii_code=ord($var[$i]);
        if ($ascii_code >=48 && $ascii_code <=57) continue;
        else return false;
    }
    if ($var < 0) return false;
    return true;
}

function is_captcha_str($var) {
    if (!is_string($var)) return false;
    if (strlen($var) === 0) return false;
    if (strlen($var)   >64) return false;
    for ($i=0;$i<strlen($var);$i++) {
        $ascii_code=ord($var[$i]);
        if ( ($ascii_code >=48 && $ascii_code <=57)
        ||   ($ascii_code >=65 && $ascii_code <=90)
        ||   ($ascii_code >=97 && $ascii_code <=122)
        ||    $ascii_code ==95
        ||    $ascii_code ==46
        ||    $ascii_code ==45) continue;
        else return false;
    }
    return true;
}

function is_type_str($var) {
    if (!is_string($var)) return false;
    if (strlen($var) === 0) return false;
    if (strlen($var)   >64) return false;
    for ($i=0;$i<strlen($var);$i++) {
        $ascii_code=ord($var[$i]);
        if ( ($ascii_code >=48 && $ascii_code <=57)  //  0 - 9
        ||   ($ascii_code >=65 && $ascii_code <=90)  //  A - Z
        ||   ($ascii_code >=97 && $ascii_code <=122) //  a - z
        ||    $ascii_code ==95                       //    _
        ||    $ascii_code ==46                       //    .
        ||    $ascii_code ==45                       //    -
        ||    $ascii_code ==43                       //    +
        ||    $ascii_code ==47) continue;            //    /
        else return false;
    }
    return true;
}

function is_bitcoin_address($address) {
    if (!is_string($address)) return false;
    $origbase58 = $address;
    $dec = "0";

    for ($i = 0; $i < strlen($address); $i++) {
        $dec = bcadd(bcmul($dec,"58",0),strpos("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",substr($address,$i,1)),0);
    }

    $address = "";

    while (bccomp($dec,0) == 1) {
        $dv = bcdiv($dec,"16",0);
        $rem = (integer)bcmod($dec,"16");
        $dec = $dv;
        $address = $address.substr("0123456789ABCDEF",$rem,1);
    }

    $address = strrev($address);

    for ($i = 0; $i < strlen($origbase58) && substr($origbase58,$i,1) == "1"; $i++) {
        $address = "00".$address;
    }

    if (strlen($address)%2 != 0) {
        $address = "0".$address;
    }

    if (strlen($address) != 50) {
        return false;
    }

    if (hexdec(substr($address,0,2)) > 0) {
        return false;
    }

    return substr(strtoupper(hash("sha256",hash("sha256",pack("H*",substr($address,0,strlen($address)-8)),true))),0,8) == substr($address,strlen($address)-8);
}

function is_email($var) {
    if (!is_string($var)) return false;
    if(filter_var($var, FILTER_VALIDATE_EMAIL)) {
        return true;
    }
    return false;
}

function AES_256_decrypt($edata, $key_32B, $iv_16B) {
    if (strlen($key_32B) !== 64 || !ctype_xdigit($key_32B)
    ||  strlen($iv_16B)  !== 32 || !ctype_xdigit($iv_16B)) return null;

    $key_32B = pack("H*",$key_32B);
    $iv_16B  = pack("H*",$iv_16B);

    if (strlen($key_32B) !== 32
    ||  strlen($iv_16B)  !== 16)
        return null;
    $data = base64_decode($edata);
    return openssl_decrypt($data, 'aes-256-cfb', $key_32B, true, $iv_16B);
}

function AES_256_encrypt($data, $key_32B, $iv_16B) {
    if (strlen($key_32B) !== 64 || !ctype_xdigit($key_32B)
    ||  strlen($iv_16B)  !== 32 || !ctype_xdigit($iv_16B)) return null;

    $key_32B = pack("H*",$key_32B);
    $iv_16B  = pack("H*",$iv_16B);

    if (strlen($key_32B) !== 32
    ||  strlen($iv_16B)  !== 16)
        return null;

    $encrypted_data = openssl_encrypt($data, 'aes-256-cfb', $key_32B, true, $iv_16B);
    return base64_encode($encrypted_data);
}

function generateRandomString($length = 10) {
    $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $randomString;
}

function assure_table($link, $table, $creation) {
    $link->query("SHOW TABLES LIKE '".$table."'");
    $tableExists = $link->affected_rows > 0;

    if (!$tableExists) {
        $link->query($creation);
        $link->query("SHOW TABLES LIKE '".$table."'");
        $tableExists = $link->affected_rows > 0;
        if (!$tableExists) return false;
    }
    return true;
}

function assure_stats($link) {
    return assure_table($link, 'stats', "CREATE TABLE `stats` (
 `nr` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key. Unsigned integer.',
 `date` date NOT NULL DEFAULT current_timestamp() COMMENT 'Date of the statistics.',
 `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Last time this record was updated.',
 `decoder` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'TRUE when CryptoGraffiti Decoder is online.',
 `encoder` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'TRUE when CryptoGraffiti Encoder is online.',
 `sat_byte` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'Currently estimated fee (satoshis per byte).',
 `btc_donations` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of satoshis received as donations.',
 `steps` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of steps made with cron_second task calls.',
 `overload` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of times cron_second task iteration exceeded the time limit.',
 `sessions` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of sessions currently active.',
 `IPs` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of different IPs that currently have an active session.',
 `max_sessions` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Maximum number of active sessions during that day.',
 `max_IPs` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Maximum number of active IPs during that day.',
 `database_requests` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of API requests made this day.',
 `invalid_requests` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of invalid API requests made this day. This is a sign of API abuse or hacking attempts.',
 `free_tokens` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of free tokens given out lately.',
 `errors` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of internal errors. This should be always zero.',
 `last_error` int(10) unsigned DEFAULT NULL COMMENT 'Indicates the last critical error by its line number where it occurred.',
 `banned_requests` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of requests made from banned IPs.',
 `updates` int(11) NOT NULL DEFAULT 0 COMMENT 'The number of times this record has been modified.',
 PRIMARY KEY (`nr`),
 UNIQUE KEY `date` (`date`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1");
}

function assure_session($link) {
    return assure_table($link, 'session', "CREATE TABLE `session` (
 `nr` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key. Unsigned integer.',
 `alias` varchar(32) CHARACTER SET utf16 COLLATE utf16_bin DEFAULT NULL COMMENT 'Human friendly name given to the session.',
 `role` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'Role bits that indicate the roles of this session. Extracting the roles needs bitwise checking.',
 `flags` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'Session flag bits.',
 `requests` int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of database requests this session has made.',
 `last_request` datetime DEFAULT NULL COMMENT 'Last time when this session called API.',
 `start_time` datetime DEFAULT NULL COMMENT 'Last time when this session was activated.',
 `end_time` datetime DEFAULT NULL COMMENT 'Last time when this session was considered inactive. NULL when the session is currently active.',
 `last_update` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Last time this record was modified.',
 `ip` varchar(45) DEFAULT NULL COMMENT 'Last IP associated with this session.',
 `guid` binary(32) NOT NULL COMMENT 'Unique index, generated by the client. Should be kept in secret.',
 `nonce` binary(32) DEFAULT NULL COMMENT 'When using ALS, this nonce is used for cyphering and integrity checking. Also it protects agains replay attacks.',
 `seed` binary(32) DEFAULT NULL COMMENT 'Used when finding the next nonce.',
 PRIMARY KEY (`nr`),
 UNIQUE KEY `guid` (`guid`),
 KEY `ip` (`ip`),
 KEY `role` (`role`),
 KEY `flags` (`flags`),
 KEY `end_time` (`end_time`),
 KEY `last_request` (`last_request`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1");
}

function assure_security($link) {
    return assure_table($link, 'security', "CREATE TABLE `security` (  `nr` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key. Unsigned integer.',  `ip` varchar(32) DEFAULT NULL COMMENT 'IP of the device that created this record.',  `start_time` datetime DEFAULT NULL COMMENT 'Creation time of the record.',  `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last time update was made on this record.',  `key` binary(32) NOT NULL COMMENT 'Secret key used to maintain security with the user who created this record.',  `hash` binary(32) NOT NULL COMMENT 'Hash taken from key.',  PRIMARY KEY (`nr`),  UNIQUE KEY `key` (`key`,`hash`)) ENGINE=InnoDB DEFAULT CHARSET=latin1");
}

function assure_address($link) {
    return assure_table($link, 'address', "CREATE TABLE `address` (  `nr` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key. Unsigned integer.',  `ip` varchar(45) NOT NULL COMMENT 'IP address. Can store IPv6 if needed.',  `banned` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'True when this address is banned and will not be served.',  `requests` int(10) unsigned NOT NULL DEFAULT '0' COMMENT 'Number of requests made from this address.',  `rpm` int(10) unsigned NOT NULL DEFAULT '0' COMMENT 'Requests Per Minute.',  `max_rpm` int(10) unsigned NOT NULL DEFAULT '60' COMMENT 'Maximum number of requests per minute.',  `free_tokens` int(10) unsigned NOT NULL DEFAULT '0' COMMENT 'Number of free tokens given to this address lately.',  `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last time when this record was changed.',  PRIMARY KEY (`nr`),  UNIQUE KEY `ip` (`ip`),  KEY `banned` (`banned`),  KEY `rpm` (`rpm`),  KEY `free_tokens` (`free_tokens`),  KEY `rpm_2` (`rpm`)) ENGINE=InnoDB DEFAULT CHARSET=latin1");
}

function assure_captcha($link) {
    return assure_table($link, 'captcha', "CREATE TABLE `captcha` (
 `nr` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key. Unsigned integer.',
 `sticky` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'When set to TRUE this token will not get deleted after use.',
 `fused` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'TRUE when this token has been disabled to avoid greater damage.',
 `token` binary(32) NOT NULL COMMENT 'Client sends this to display Proof of Work.',
 `rpm` int(10) unsigned NOT NULL DEFAULT '0' COMMENT 'Requests per minute.',
 `max_rpm` int(10) unsigned NOT NULL DEFAULT '60' COMMENT 'Maximum number of requests per minute.',
 `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last time the record got updated.',
 PRIMARY KEY (`nr`),
 UNIQUE KEY `token` (`token`),
 KEY `rpm` (`rpm`),
 KEY `last_update` (`last_update`),
 KEY `sticky` (`sticky`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1");
}

function assure_log($link) {
    return assure_table($link, 'log', "CREATE TABLE `log` (  `nr` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key. Unsigned big integer.',  `file` varchar(8) NOT NULL COMMENT 'File name of the originator script.',  `line` int(10) unsigned NOT NULL COMMENT 'Line number of the originating function call.',  `ip` varchar(45) DEFAULT NULL COMMENT 'IP associated with the cause of this log entry.',  `session_nr` int(10) unsigned DEFAULT NULL COMMENT 'Session number associated with the origination of this log entry.',  `fun` varchar(32) DEFAULT NULL COMMENT 'API function associated with the origination of this log entry.',  `level` int(11) NOT NULL DEFAULT '0' COMMENT 'Importance level of this log entry.',  `text` varchar(1024) NOT NULL DEFAULT '' COMMENT 'Textual body of this log entry.',  `creation_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation time of this log entry.',  PRIMARY KEY (`nr`),  KEY `ip` (`ip`,`session_nr`,`fun`,`level`)) ENGINE=InnoDB DEFAULT CHARSET=latin1");
}

function assure_btc_tx($link) {
    return assure_table($link, 'btc_tx', "CREATE TABLE `btc_tx` (
 `nr` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Unique integer identifier.',
 `type` varchar(64) DEFAULT NULL COMMENT 'Message content type.',
 `fsize` int(10) unsigned DEFAULT NULL COMMENT 'If null then we do not know if the TX contains a block chain file. If zero then it does not contain a file. If positive then it indicates the size of the block chain file found from this TX.',
 `amount` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'Number of satoshis included as donation.',
 `creation_time` timestamp NULL DEFAULT NULL COMMENT 'Indicates the date and time when this entry was inserted.',
 `last_update` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Indicates the last update on this entry.',
 `confirmed` tinyint(1) DEFAULT NULL COMMENT 'TRUE when enough confirmations. FALSE when not enough. NULL when unknown.',
 `hash` binary(32) DEFAULT NULL COMMENT 'Transaction hash.',
 `msg_hash` binary(32) DEFAULT NULL COMMENT 'Hash of the message encoded into this transaction.',
 PRIMARY KEY (`nr`),
 UNIQUE KEY `hash` (`hash`),
 KEY `confirmed` (`confirmed`),
 KEY `amount` (`amount`),
 KEY `type` (`type`),
 KEY `msg_hash` (`msg_hash`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1");
}

function assure_graffiti($link) {
    return assure_table($link, 'graffiti', "CREATE TABLE `graffiti` (
 `nr` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
 `txid` binary(32) NOT NULL COMMENT 'TX hash',
 `location` varchar(16) NOT NULL DEFAULT 'NULL_DATA' COMMENT 'location of the payload within the TX',
 `fsize` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'file size in bytes',
 `offset` bigint(20) NOT NULL DEFAULT 0 COMMENT 'first byte offset of the file',
 `mimetype` varchar(64) NOT NULL DEFAULT 'application/octet-stream' COMMENT 'file MIME type',
 `hash` binary(20) DEFAULT NULL COMMENT 'RIPEMD-160 hash of the file',
 `created` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'creation timestamp',
 `modified` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'timestamp of the last update',
 PRIMARY KEY (`nr`),
 UNIQUE KEY `identifier` (`txid`,`location`,`offset`) USING BTREE COMMENT 'prevents duplicate graffiti',
 KEY `txid` (`txid`),
 KEY `mimetype` (`mimetype`),
 KEY `hash` (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8");
}

function assure_order($link) {
    return assure_table($link, 'order', "CREATE TABLE `order` (
 `nr` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key. Unique integer identifier.',
 `group` int(10) unsigned NOT NULL COMMENT 'Number of the group this order belongs to.',
 `input` mediumtext CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'Request data for the executive bitbroker.',
 `output` text CHARACTER SET utf8 COLLATE utf8_bin NOT NULL DEFAULT '' COMMENT 'Response given by the executive bitbroker.',
 `executive` int(10) unsigned DEFAULT NULL COMMENT 'Session number of the responsible executive.',
 `creation_time` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Date and time when this entry was made.',
 `accepted` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'TRUE when some executive bitbroker is currently processing this order.',
 `filled` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'TRUE when this order has been filled and can be safely deleted.',
 PRIMARY KEY (`nr`),
 KEY `encoder` (`executive`),
 KEY `group` (`group`),
 KEY `locked` (`accepted`),
 KEY `filled` (`filled`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1");
}

function ALS_extract($link, $fun, $data, $sec_hash, $salt, $checksum, &$security_key) {
    if (!is_string($sec_hash)
    ||  strlen($sec_hash) !== 64
    ||  !ctype_xdigit($sec_hash)) return make_failure(ERROR_INVALID_ARGUMENTS, 'Invalid `sec_hash`.');

    if (!is_string($salt)
    ||  strlen($salt) !== 32
    ||  !ctype_xdigit($salt)) return make_failure(ERROR_INVALID_ARGUMENTS, 'Invalid `salt`.');

    if (!is_string($checksum)
    ||  strlen($checksum) !== 32
    ||  !ctype_xdigit($checksum)) return make_failure(ERROR_INVALID_ARGUMENTS, 'Invalid `checksum`.');

    $sec_key = null;
    $result = $link->query("SELECT `key` FROM `security` WHERE `hash` = X'".$sec_hash."' LIMIT 1");
    if ($link->errno === 0) {
        if ($row = $result->fetch_assoc()) {
            $sec_key = $row['key'];
        }
        else return make_failure(ERROR_INVALID_ARGUMENTS, 'Unknown `sec_hash`.');
    }
    else return make_failure(ERROR_SQL, $link->error);

    if ($sec_key === null) return make_failure(ERROR_INTERNAL, 'Cannot find `sec_key`.');

    if ( ($data = AES_256_decrypt($data, bin2hex($sec_key), $salt)) === false || $data === null) {
        return make_failure(ERROR_INVALID_ARGUMENTS, 'Data decryption failed.');
    }

    $cs = md5($data.bin2hex($sec_key), true);
    if ($cs !== pack("H*",$checksum)) {
        return make_failure(ERROR_INVALID_ARGUMENTS, 'Data integrity check failed, wrong checksum! Did you forget to encrypt?');
    }

    $security_key = $sec_key;
    return $data;
}

function extract_args($data) {
    $result = array();
    $args = json_decode($data, true);
    if ( !is_array($args) ) $args = array();

    extract_hex64    ('guid',        $args, $result);
    extract_hex64    ('key',         $args, $result);
    extract_hex64    ('hash',        $args, $result);
    extract_hex64    ('nonce',       $args, $result);
    extract_hex64    ('token',       $args, $result);
    extract_num      ('min_time',    $args, $result);
    extract_num      ('max_time',    $args, $result);
    extract_num      ('min_forfeit', $args, $result);
    extract_num      ('max_forfeit', $args, $result);
    extract_num      ('nr',          $args, $result);
    extract_num      ('group',       $args, $result);
    extract_num      ('round_nr',    $args, $result);
    extract_num      ('ticket_nr',   $args, $result);
    extract_num      ('tx_nr',       $args, $result);
    extract_num      ('count',       $args, $result);
    extract_num      ('fee',         $args, $result);
    extract_num      ('amount',      $args, $result);
    extract_num      ('executive',   $args, $result);
    extract_bool     ('live',        $args, $result);
    extract_bool     ('scam',        $args, $result);
    extract_bool     ('back',        $args, $result);
    extract_bool     ('inclusive',   $args, $result);
    extract_bool     ('filled',      $args, $result);
    extract_bool     ('accepted',    $args, $result);
    extract_bool     ('restore',     $args, $result);
    extract_date     ('start_date',  $args, $result);
    extract_date     ('end_date',    $args, $result);
    extract_btc_addr ('btc_addr',    $args, $result);
    extract_email    ('email',       $args, $result);
    extract_txs      ('txs',         $args, $result);
    extract_graffiti ('graffiti',    $args, $result);
    extract_txids    ('txids',       $args, $result);
    extract_json     ('input',       $args, $result);
    extract_json     ('output',      $args, $result);
    extract_mimetype ('mimetype',    $args, $result);
    extract_str      ('to',          $args, $result); // Vulnerable to SQL injection by default.
    extract_str      ('subj',        $args, $result); // Vulnerable to SQL injection by default.
    extract_str      ('msg',         $args, $result); // Vulnerable to SQL injection by default.
    extract_str      ('headers',     $args, $result); // Vulnerable to SQL injection by default.
    extract_str      ('name',        $args, $result); // Vulnerable to SQL injection by default.
    extract_str      ('value',       $args, $result); // Vulnerable to SQL injection by default.
    return $result;
}

function extract_mimetype($var, $args, &$result) {
    if (array_key_exists($var, $args)
    and is_string($args[$var])) {
        $val = $args[$var];
        if (is_type_str($val)) {
            $result[$var] = $val;
            return true;
        }
    }
    $result[$var] = null;
    return false;
}

function extract_str($var, $args, &$result) {
    // Never use variables extracted with this function directly in SQL queries!
    if (array_key_exists($var, $args)
    and is_string($args[$var])) {
        $result[$var] = $args[$var];
        return true;
    }
    $result[$var] = null;
    return false;
}

function extract_date($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  strlen($args[$var]) === 10) {
        $parts = explode('-', $args[$var], 3);
        if (count($parts) === 3) {
            if (is_num($parts[0]) && strlen($parts[0]) === 4
            &&  is_num($parts[1]) && strlen($parts[1]) === 2
            &&  is_num($parts[2]) && strlen($parts[2]) === 2) {
                $result[$var] = $args[$var];
                return true;
            }
        }
    }

    $result[$var] = null;
    return false;
}

function extract_num($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  strlen($args[$var]) < 10
    &&  is_num($args[$var])) {
        $result[$var] = $args[$var];
        return true;
    }
    $result[$var] = null;
    return false;
}

function extract_json($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  is_array($args[$var])) {
        $result[$var] = json_encode($args[$var]);
        return true;
    }

    $result[$var] = null;
    return false;
}

function extract_bool($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  strlen($args[$var]) ===  1
    && ($args[$var]         === '1'
    ||  $args[$var]         === '0') ) {
        $result[$var] = $args[$var];
        return true;
    }
    $result[$var] = null;
    return false;
}

function extract_hex64($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  strlen($args[$var]) === 64
    &&  ctype_xdigit($args[$var])) {
        $result[$var] = $args[$var];
        return true;
    }
    $result[$var] = null;
    return false;
}

function extract_btc_addr($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  is_bitcoin_address($args[$var])) {
        $result[$var] = $args[$var];
        return true;
    }
    $result[$var] = null;
    return false;
}

function extract_email($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  is_email($args[$var])) {
        $result[$var] = $args[$var];
        return true;
    }
    $result[$var] = null;
    return false;
}

function extract_txids($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  is_array($args[$var])) {
        $result[$var] = array();
        foreach ($args[$var] as $index => $hash) {
            if (strlen($hash) === 64
            &&  ctype_xdigit($hash)) {
                $result[$var][] = $hash;
            }
            else {
                $result[$var] = null;
                return false;
            }
        }
    }

    return true;
}

function extract_txs($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  is_array($args[$var])) {
        $result[$var] = array();
        foreach ($args[$var] as $hash => $data) {
            if (strlen($hash) === 64
            &&  ctype_xdigit($hash)
            &&  array_key_exists('conf', $data)
            &&  is_num($data['conf'])) {
                $buf = array('conf'   => intval($data['conf']),
                             'amount' => null,
                             'type'   => null,
                             'fsize'  => null,
                             'hash'   => null
                );

                if (array_key_exists('amount', $data) && is_num($data['amount'])) {
                    $buf['amount'] = intval($data['amount']);
                }

                if (array_key_exists('type', $data) && is_type_str($data['type'])) {
                    $buf['type'] = strval($data['type']);
                }

                if (array_key_exists('fsize', $data) && is_num($data['fsize'])) {
                    $buf['fsize'] = intval($data['fsize']);
                }

                if (array_key_exists('hash', $data)
                &&  strlen($data['hash']) === 64
                &&  ctype_xdigit($data['hash']) ) {
                    $buf['hash'] = strval($data['hash']);
                }

                $result[$var][$hash] = $buf;
            }
            else {
                $result[$var] = null;
                return false;
            }
        }
    }

    return true;
}

function extract_graffiti($var, $args, &$result) {
    if (array_key_exists($var, $args)
    &&  is_array($args[$var])) {
        $result[$var] = array();
        foreach ($args[$var] as $hash => $data) {
            if (strlen($hash) === 64
            &&  ctype_xdigit($hash)
            &&  array_key_exists('files', $data)
            &&  is_array($data['files'])
            &&  array_key_exists('txsize', $data)
            &&  is_num($data['txsize'])
            &&  intval($data['txsize']) > 0) {
                $buf = array('txsize' => intval($data['txsize']),
                             'files'  => array()
                );

                foreach ($data['files'] as $nr => $fdata) {
                    if (array_key_exists('location', $fdata)
                    &&  is_type_str($fdata['location'])
                    &&  array_key_exists('fsize', $fdata)
                    &&  is_num($fdata['fsize'])
                    &&  intval($fdata['fsize']) >= 0
                    &&  array_key_exists('offset', $fdata)
                    &&  is_num($fdata['offset'])
                    &&  intval($fdata['offset']) >= 0
                    &&  array_key_exists('type', $fdata)
                    &&  is_type_str($fdata['type'])
                    &&  array_key_exists('hash', $fdata)
                    &&  strlen($fdata['hash']) === 40
                    &&  ctype_xdigit($fdata['hash'])) {
                        $buf['files'][] = array(
                            "location"  => $fdata['location'],
                            "fsize"     => intval($fdata['fsize']),
                            "offset"    => intval($fdata['offset']),
                            "type"      => $fdata['type'],
                            "hash"      => $fdata['hash']
                        );
                    }
                    else {
                        $result[$var] = null;
                        return false;
                    }
                }

                $result[$var][$hash] = $buf;
            }
            else {
                $result[$var] = null;
                return false;
            }
        }
    }

    return true;
}

function get_session_nr($link, $guid) {
    if (strlen($guid) !== 64 || !ctype_xdigit($guid) || !$link) return null;

    $guid   = $link->real_escape_string($guid);
    $result = $link->query("SELECT `nr` FROM `session` WHERE `guid` = X'".$guid."'");

    if ($result === false) return null;
    if ($row = $result->fetch_assoc()) return $row["nr"];

    return null;
}

function get_session_variable($link, $guid, $var) {
    if ( strlen($guid) !== 64 || !ctype_xdigit($guid) ) return null;

    $guid   = $link->real_escape_string($guid);
    $var    = $link->real_escape_string($var);
    $result = $link->query("SELECT `".$var."` FROM `session` WHERE `guid` = X'".$guid."' LIMIT 1");

    if ($result === false) return null;
    if ($row = $result->fetch_assoc()) return $row[$var];

    return null;
}

function increase_addr_stat($link, $IP, $stat, $val = 1) {
    $stat   = $link->real_escape_string($stat);
    $val    = $link->real_escape_string($val);
    $IP     = $link->real_escape_string($IP);
    $retries= 3;

    Again:
    $link->query("UPDATE `address` SET `".$stat."` = (@new_value := `".$stat."` + '".$val."') WHERE `ip` = '".$IP."'");
    if ($link->errno !== 0) {
        if (--$retries > 0) {
            usleep(mt_rand(1,10000));
            goto Again; // Sometimes deadlocks happen, it's normal.
        }
        set_critical_error($link, $link->error);
        return null;
    }
    else {
        if ($link->affected_rows === 0) {
            $link->query("INSERT IGNORE INTO `address` (`ip`, `".$stat."`) VALUES('".$IP."', '".$val."')");
            if ($link->errno !== 0) {set_critical_error($link, $link->error); return null;}
            if ($link->affected_rows === 0) return null;
        }
        else {
            $result = $link->query("SELECT @new_value AS `statnow`");
            if ($link->errno !== 0) set_critical_error($link, $link->error);
            else return intval($result->fetch_assoc()['statnow']);
        }
    }

    return $val;
}

function set_addr_stat($link, $IP, $stat, $val) {
    $stat = $link->real_escape_string($stat);
    $val  = $link->real_escape_string($val);
    $IP   = $link->real_escape_string($IP);

    $link->query("UPDATE `address` SET `".$stat."` = '".$val."' WHERE `ip` = '".$IP."'");
    if ($link->errno !== 0) {set_critical_error($link, $link->error); return false;}
    else {
        if ($link->affected_rows === 0) {
            $link->query("INSERT IGNORE INTO `address` (`ip`, `".$stat."`) VALUES('".$IP."', '".$val."')");
            if ($link->errno !== 0) {set_critical_error($link, $link->error); return false;}
            if ($link->affected_rows === 0) return false;
        }
    }

    return true;
}

function get_addr_stat($link, $IP, $stat) {
    $stat = $link->real_escape_string($stat);
    $IP   = $link->real_escape_string($IP);

    $result = $link->query("SELECT `".$stat."` FROM `address` WHERE `ip` = '".$IP."' LIMIT 1");
    if ($link->errno !== 0) {
        set_critical_error($link, $link->error);
        return null;
    }

    if ($row = $result->fetch_assoc()) {
        if (array_key_exists($stat, $row)) return $row[$stat];
    }
    return null;
}

function increase_stat($link, $stat, $val = 1) {
    $stat = $link->real_escape_string($stat);
    $val  = $link->real_escape_string($val);

    $link->query("UPDATE `stats` SET `".$stat."` = `".$stat."` + '".$val."', `updates` = `updates` + '1' WHERE `date` = CURDATE()");
    if ($link->errno !== 0) {set_critical_error($link, $link->error); return false;}
    else {
        if ($link->affected_rows === 0) {
            $link->query("INSERT IGNORE INTO `stats` (`date`, `".$stat."`) VALUES(CURDATE(), '".$val."')");

            if ($link->errno !== 0) {set_critical_error($link, $link->error); return false;}
            if ($link->affected_rows === 0) return false;
        }
    }

    return true;
}

function set_stat($link, $stat, $val) {
    $stat = $link->real_escape_string($stat);
    $val  = $link->real_escape_string($val);

    $link->query("UPDATE `stats` SET `".$stat."` = '".$val."', `updates` = `updates` + '1' WHERE `date` = CURDATE()");
    if ($link->errno !== 0) {set_critical_error($link, $link->error); return false;}
    else {
        if ($link->affected_rows === 0) {
            $link->query("INSERT IGNORE INTO `stats` (`date`, `".$stat."`) VALUES(CURDATE(), '".$val."')");
            if ($link->errno !== 0) {set_critical_error($link, $link->error); return false;}
            if ($link->affected_rows === 0) return false;
        }
    }

    return true;
}

function get_stat($link, $stat, $days_back = 0) {
    $days_back = intval($days_back);
    $stat      = $link->real_escape_string($stat);
    $val       = $link->real_escape_string($val);

    $result = $link->query("SELECT `".$stat."` FROM `stats` WHERE `date` = (CURDATE() - INTERVAL ".$days_back." day) LIMIT 1");
    if ($link->errno !== 0) {
        set_critical_error($link, $link->error);
        return null;
    }

    if ($row = $result->fetch_assoc()) {
        if (array_key_exists($stat, $row)) return $row[$stat];
    }
    return null;
}

function find_token($link, $token) {
    $token = $link->real_escape_string($token);

    $result = $link->query("SELECT `rpm`, `max_rpm` FROM `captcha` WHERE `token` = X'".$token."' LIMIT 1");
    if ($link->errno !== 0) {
        set_critical_error($link, $link->error);
        return false;
    }

    if ($row = $result->fetch_assoc()) {
        return array('rpm'     => intval($row['rpm'    ]),
                     'max_rpm' => intval($row['max_rpm'])
                    );
    }
    return null;
}

function token_exists($link, $token) {
    $token = $link->real_escape_string($token);

    $result = $link->query("SELECT `nr` FROM `captcha` WHERE `token` = X'".$token."' LIMIT 1");
    if ($link->errno !== 0) {
        set_critical_error($link, $link->error);
        return false;
    }

    if ($row = $result->fetch_assoc()) {
        return true;
    }
    return false;
}

function increase_session_stat($link, $session_id, $stat, $val = 1) {
    $session_id = $link->real_escape_string($session_id);
    $stat       = $link->real_escape_string($stat);
    $val        = $link->real_escape_string($val);

    if (strlen($session_id) === 64 && ctype_xdigit($session_id)) {
        $link->query("UPDATE `session` SET `".$stat."` = `".$stat."` + '".$val."' WHERE `guid` = X'".$session_id."'");
    }
    else {
        $link->query("UPDATE `session` SET `".$stat."` = `".$stat."` + '".$val."' WHERE `nr` = '".$session_id."'");
    }

    if ($link->errno !== 0) {
        set_critical_error($link, $link->error);
        return false;
    }

    return true;
}

function update_session_stat($link, $session_id, $stat, $val) {
    $session_id = $link->real_escape_string($session_id);
    $stat       = $link->real_escape_string($stat);
    $val        = $link->real_escape_string($val);

    if (strlen($session_id) === 64 && ctype_xdigit($session_id)) {
        $link->query("UPDATE `session` SET `".$stat."` = '".$val."' WHERE `guid` = X'".$session_id."'");
    }
    else {
        $link->query("UPDATE `session` SET `".$stat."` = '".$val."' WHERE `nr` = '".$session_id."'");
    }

    if ($link->errno !== 0) {
        set_critical_error($link, $link->error);
        return false;
    }

    return true;
}

function insert_entry($link, $table, $vars) {
    if (count($vars)) {
        $table = $link->real_escape_string($table);
        foreach ($vars as &$var) $var = $link->real_escape_string($var);

        $req = "INSERT INTO `$table` (`". join('`, `', array_keys($vars)) ."`) VALUES ('".join("', '", $vars) ."')";
        //db_log($link, null, $req, LOG_MINOR);
        $res = $link->query($req);

        if ($link->errno !== 0) {
            set_critical_error($link, $link->error);
            return null;
        }
        if ($link->errno === 0 && $link->affected_rows > 0) return $link->insert_id;
    }
    return null;
}

function insert_unique($link, $table, $vars) {
    if (count($vars)) {
        $table = $link->real_escape_string($table);
        foreach ($vars as &$var) $var = $link->real_escape_string($var);

        $req  = "INSERT INTO `$table` (`". join('`, `', array_keys($vars)) ."`) ";
        $req .= "SELECT '". join("', '", $vars) ."' FROM DUAL ";
        $req .= "WHERE NOT EXISTS (SELECT 1 FROM `$table` WHERE ";

        foreach ($vars AS $col => $val) $req .= "`$col`='$val' AND ";

        $req = substr($req, 0, -5) . ") LIMIT 1";
        $res = $link->query($req);
        if ($link->errno !== 0) {
            set_critical_error($link, $link->error);
            return null;
        }
        if ($link->errno === 0 && $link->affected_rows > 0) return $link->insert_id;
    }
    return null;
}

function insert_hex_unique($link, $table, $vars) {
    if (count($vars)) {
        $table = $link->real_escape_string($table);
        foreach ($vars as &$var) $var = $link->real_escape_string($var);

        $req = "INSERT INTO `$table` (`". join('`, `', array_keys($vars)) ."`) ";
        $req .= "SELECT X'". join("', X'", $vars) ."' FROM DUAL ";
        $req .= "WHERE NOT EXISTS (SELECT 1 FROM `$table` WHERE ";

        foreach ($vars AS $col => $val) $req .= "`$col`= X'$val' AND ";

        $req = substr($req, 0, -5) . ") LIMIT 1";
        $res = $link->query($req);
        if ($link->errno !== 0) {
            set_critical_error($link, $link->error);
            return null;
        }
        if ($link->errno === 0 && $link->affected_rows > 0)  return $link->insert_id;
    }
    return null;
}

function insert_unique_graffiti($link, $table, $txid, $loc, $offset) {
    $table = $link->real_escape_string($table);
    $txid = $link->real_escape_string($txid);
    $loc = $link->real_escape_string($loc);
    $offset = $link->real_escape_string($offset);

    $req = "INSERT INTO `$table` (`txid`, `location`, `offset`) ";
    $req .= "SELECT X'".$txid."', '".$loc."', '".$offset."' FROM DUAL ";
    $req .= "WHERE NOT EXISTS (SELECT 1 FROM `$table` WHERE ";
    $req .= "`txid` = X'".$txid."' AND `location` = '".$loc."' AND `offset` = '".$offset."' ";
    $req .= ") LIMIT 1";

    $res = $link->query($req);
    if ($link->errno !== 0) {
        set_critical_error($link, $link->error);
        return null;
    }
    if ($link->errno === 0 && $link->affected_rows > 0)  return $link->insert_id;

    return null;
}

function insert_dummy($link, $table) {
    $sql = "INSERT INTO `".$table."` () VALUES ()";
    $res = $link->query($sql);

    if ($res === false || $link->errno !== 0) {
        db_log($link, null, 'Failed to insert a dummy record to `'.$table.'` table.', LOG_ERROR);
        return null;
    }
    return $link->insert_id;
}

function fun_handshake($link, $user, $IP, $key, $HTTPS) {
    if (strlen($key) !== 64 || !ctype_xdigit($key)) return make_failure(ERROR_INVALID_ARGUMENTS, '`sec_key` is invalid.');
    $hash = hash("sha256", pack("H*",$key), false);
    if (strlen($hash) !== 64 || !ctype_xdigit($hash)) return make_failure(ERROR_INTERNAL, '`hash` is invalid.');

    $nr = insert_hex_unique($link, 'security', array('key' => $key, 'hash' => $hash));

    if ($nr !== null) {
        $ip = $link->real_escape_string($IP);

        $q = db_query($link, "UPDATE `security` SET `ip` = '".$ip."', `start_time` = NOW() WHERE `nr` = '".$nr."'");
        if ($q['errno']         !== 0) return make_failure(ERROR_SQL, $q['error']);
        if ($q['affected_rows'] === 0) return make_failure(ERROR_INTERNAL, 'Nothing changed after update of `security` WHERE `nr` = `'.$nr.'`.');
    }
    else {
        return make_failure(ERROR_NO_CHANGE, 'Such security `key` or its `hash` already exists.');
    }
    db_log($link, $user, 'Successful security handshake #'.$nr.' -'.($HTTPS ? ' HTTPS was enabled.' : ' HTTPS was disabled.'), LOG_NORMAL);
    return make_success(array('TLS' => $HTTPS));
}

function fun_init($link, $user, $IP, $guid, $sec_hash, $HTTPS, $restore) {
    if ($guid === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.');
    $ALS   = false;
    $nonce = '';
    $sec_key = null;
    $seed = '';

    $ip = $link->real_escape_string($user['ip']);

    if (!is_string($sec_hash)
    ||  strlen($sec_hash) !== 64
    || !ctype_xdigit($sec_hash)) $sec_hash = null;

    if ($sec_hash !== null) {
        $q = db_query($link, "SELECT `key` FROM `security` WHERE `hash` = X'".$sec_hash."' LIMIT 1");
        if ($q['errno'] === 0) {
            if ($row = $q['result']->fetch_assoc()) {
                $sec_key = bin2hex($row['key']);
                if ($sec_key === null) {
                    return make_failure(ERROR_INTERNAL, 'Security Key is NULL for Security Hash `'.$sec_hash.'`.');
                }
            }
            else return make_failure(ERROR_MISUSE, 'Security Handshake has not been performed for this `sec_hash`.');
        }
        else return make_failure(ERROR_SQL, $q['error']);

        $ALS = true; // Custom Application Layer Security is used,
                     // assuming that Security Hanshake has been done.
        $nonce = hash("sha256", $sec_key.mt_rand(), false);
        $seed  = hash("sha256", $sec_key.mt_rand(), false);
    }

    $nr = insert_hex_unique($link, 'session', array('guid' => $guid));

    if ($nr !== null) {
        $next_nonce = hash("sha256", pack('H*',$nonce.$seed), false);

        $q = db_query($link, "UPDATE `session` SET ".
                             ($ALS ? "`nonce` = X'".$next_nonce."', `seed` = X'".$seed."', " : "").
                             "`ip` = '".$ip."', `start_time` = NOW() WHERE `nr` = '".$nr."'");
        if ($q['errno'] !== 0) return make_failure(ERROR_SQL, $q['error']);
        if ($q['affected_rows'] === 0) {
            return make_failure(ERROR_NO_CHANGE, 'Nothing changed after update of `session` WHERE `nr` = `'.$nr.'`.');
        }
    }
    else {
        if (($nr = get_session_nr($link, $guid)) === null) $nr = 'N/A';

        $extra_info = array('TLS' => $HTTPS, 'ALS' => $ALS);
        if ($ALS) {
            $nonce = get_session_variable($link, $guid, 'nonce');
            $seed  = get_session_variable($link, $guid, 'seed');

            if ($nonce === null) $nonce = hash("sha256", $sec_key.mt_rand(), true);
            if ($seed === null)  {
                $seed  = hash("sha256", $sec_key.mt_rand(), true);
                $extra_info['seed'] = bin2hex($seed);
            }

            $next_nonce = hash("sha256", $nonce.$seed, false);
            $q = db_query($link, "UPDATE `session` SET `nonce` = X'".$next_nonce."', `seed` = X'".bin2hex($seed).
                                 "', `ip` = '".$ip."', `start_time` = NOW() WHERE `guid` = X'".($guid)."'");

            if ($q['errno'] !== 0) return make_failure(ERROR_SQL, $q['error']);
            if ($q['affected_rows'] === 0) {
                return make_failure(ERROR_NO_CHANGE, 'Nothing changed after update of `session` WHERE `guid` = `'.($guid).'`.');
            }
            $extra_info['nonce'] = bin2hex($nonce);

            $alias = get_session_variable($link, $guid, "alias");
            if ($alias === null) $alias = "#".$nr;
            else                 $alias = "#".$nr." (".$alias.")";
            db_log($link, $user, 'Restored session '.$alias.'. TLS '.($HTTPS ? 'enabled' : 'disabled').
                                 ' and ALS '.($ALS ? 'enabled' : 'disabled').'.', LOG_NORMAL);

            if ($restore === '1') {
                // Existing session is being restored without returning an error.
                $response = array('TLS' => $HTTPS, 'ALS' => $ALS);
                $response['nonce'] = $extra_info['nonce'];
                $response['seed']  = $extra_info['seed'];
                return make_success($response);
            }
        }

        return make_failure(ERROR_INVALID_ARGUMENTS, 'Session #'.$nr.' has already been registered with the given `guid`.', $extra_info);
    }
    $response = array('TLS' => $HTTPS, 'ALS' => $ALS);
    if ($ALS) {
        $response['nonce'] = $nonce;
        $response['seed']  = $seed;
    }
    db_log($link, $user, 'Initialized a new session number '.$nr.
                         '. TLS '.($HTTPS ? 'enabled' : 'disabled').
                         ' and ALS '.($ALS ? 'enabled' : 'disabled').'.', LOG_NORMAL);
    return make_success($response);
}

function fun_get_session($link, $user, $guid) {
    if ($guid === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.'       );

    $response = array('session' => null);

    $result = $link->query("SELECT `nr`, `requests` FROM `session` WHERE `guid` = X'".$guid."' LIMIT 1");
    if ($link->errno === 0) {
        if ($row = $result->fetch_assoc()) {
            $response['session'] = $row;
        }
        $result->free();
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    return make_success($response);
}

function fun_get_stats($link, $user, $guid, $start_date, $end_date) {
    if ($start_date === null && $end_date === null) {
        $result = $link->query("SELECT * FROM `stats` ORDER BY `nr` desc LIMIT 1");
    }
    else {
        if ($start_date === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`start_date` is invalid.');
        if ($end_date   === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`end_date` is invalid.');

        $buf_nr1 = $link->real_escape_string($start_date);
        $buf_nr2 = $link->real_escape_string($end_date);

        $result = $link->query("SELECT * FROM `stats` WHERE `date` BETWEEN '".$buf_nr1."' AND '".$buf_nr2."' order by `nr` asc LIMIT ".STATS_PER_QUERY);
    }

    $response = array('stats' => null);
    $stats = array();

    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $stats[] = $row;
        }
        $result->free();
        $response['stats'] = $stats;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    return make_success($response);
}

function fun_get_log($link, $user, $guid, $log_nr, $count) {
    if ($guid === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.');
    if ($count  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`count` is invalid.');
    if (!has_access($link, $guid, ROLE_MONITOR)) return make_failure(ERROR_MISUSE, 'Access denied!');

    $limit = intval(min(intval($count), LOGS_PER_QUERY));

    $response = array('log' => null);
    $log = array();

    if ($limit <= 0) return make_success($response);

    $query = "SELECT * FROM `log` WHERE `nr` >= '".$log_nr."' ORDER BY `nr` ASC LIMIT ".$limit;
    if ($log_nr === null) {
        $query = "SELECT * FROM `log` ORDER BY `nr` DESC LIMIT ".$limit;
    }

    $result = $link->query($query);
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $log[] = $row;
        }
        $result->free();
        $response['log'] = $log;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    if ($log_nr === null && is_array($response['log'])) $response['log'] = array_reverse($response['log']);

    return make_success($response);
}

function fun_get_constants($link, $user, $guid) {
    $response = array('constants' => array( "API_VERSION"                   => API_VERSION,
                                            "SATOSHIS_PER_BITCOIN"          => SATOSHIS_PER_BITCOIN,
                                            "BTC_ADDRESS"                   => BTC_ADDRESS,
                                            "ENCODER_FEE_AMPLIFIER"         => ENCODER_FEE_AMPLIFIER,
                                            "STATS_PER_QUERY"               => STATS_PER_QUERY,
                                            "LOGS_PER_QUERY"                => LOGS_PER_QUERY,
                                            "ORDERS_PER_QUERY"              => ORDERS_PER_QUERY,
                                            "SESSION_TIMEOUT"               => SESSION_TIMEOUT,
                                            "CAPTCHA_TIMEOUT"               => CAPTCHA_TIMEOUT,
                                            "MAX_DATA_SIZE"                 => MAX_DATA_SIZE,
                                            "MIN_BTC_OUTPUT"                => MIN_BTC_OUTPUT,
                                            "TXS_PER_QUERY"                 => TXS_PER_QUERY,
                                            "ROWS_PER_QUERY"                => ROWS_PER_QUERY ) );

    return make_success($response);
}

function fun_make_order($link, $user, $guid, $group, $input, $token) {
    if ($group === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`group` is invalid.');
    if ($input === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`input` is invalid.');
    if ($token === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`token` is invalid.');

    if (!token_exists($link, $token)) return make_failure(ERROR_MISUSE, 'Unexpected `token`.');

    $insert = array();

    $insert['input'] = $input;
    $insert['group'] = $group;

    $nr = 0;
    if ( ($nr = insert_entry($link, 'order', $insert)) === null) {
        return make_failure(ERROR_NO_CHANGE, 'Failed to insert a new order.');
    }

    db_log($link, $user, 'Added a new order #'.$nr.' into group #'.$group.'.');

    $link->query("DELETE FROM `captcha` WHERE `token` = X'".$token."' AND `sticky` IS FALSE");

    return make_success(array('nr' => $nr));
}

function fun_accept_order($link, $user, $guid, $nr) {
    if ($guid === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.');
    if ($nr   === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`nr` is invalid.');
    if (!has_access($link, $guid, ROLE_EXECUTIVE)) return make_failure(ERROR_MISUSE, 'Access denied!');
    if (is_paralyzed($link, $guid)) return make_failure(ERROR_NO_CHANGE, 'Failed to accept order, session is paralyzed!');

    $session_nr = get_session_nr($link, $guid);

    $link->query("UPDATE `order` SET `accepted` = TRUE, `executive` = '".$session_nr."' WHERE `nr` = '".$nr."' AND `accepted` IS FALSE");
    if ($link->errno !== 0) return make_failure(ERROR_SQL, $link->error);

    if ($link->affected_rows === 0) {
        return make_failure(ERROR_NO_CHANGE, 'Failed to accept order #'.$nr.'.');
    }

    db_log($link, $user, 'Session #'.$session_nr.' accepted order #'.$nr.'.');

    return make_success();
}

function fun_set_order($link, $user, $guid, $nr, $output, $filled) {
    if ($guid   === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.');
    if ($nr     === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`nr` is invalid.');
    if ($output === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`output` is invalid.');
    if (!has_access($link, $guid, ROLE_EXECUTIVE)) return make_failure(ERROR_MISUSE, 'Access denied!');
    if (is_paralyzed($link, $guid)) return make_failure(ERROR_NO_CHANGE, 'Failed to set order, session is paralyzed!');

    $session_nr = get_session_nr($link, $guid);

    $output = $link->real_escape_string($output);

    if ($filled === null) $filled = '0';

    $link->query("UPDATE `order` SET `filled` = '".$filled."', `output` = '".$output."' ".
                 "WHERE `nr` = '".$nr."' AND `executive` = '".$session_nr."' AND `accepted` IS TRUE AND `filled` IS FALSE");
    if ($link->errno !== 0) return make_failure(ERROR_SQL, $link->error);

    if ($link->affected_rows === 0) {
        return make_failure(ERROR_NO_CHANGE, 'Failed to set order #'.$nr.'.');
    }

    db_log($link, $user, 'Session #'.$session_nr.' updated order #'.$nr.'.');

    return make_success();
}

function fun_set_stat($link, $user, $guid, $name, $value) {
    if ($guid   === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.');
    if ($name   === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`name` is invalid.');
    if ($value  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`value` is invalid.');
    if (!has_access($link, $guid, ROLE_EXECUTIVE)) return make_failure(ERROR_MISUSE, 'Access denied!');
    if (is_paralyzed($link, $guid)) return make_failure(ERROR_NO_CHANGE, 'Failed to set stat, session is paralyzed!');

    $result = array();
    $args   = array();
    $args["sat_byte"] = $value;

    $success = false;
    switch ($name) {
        case 'sat_byte' : $success = extract_num($name, $args, $result); break;
        default         : return make_failure(ERROR_NO_CHANGE, 'Failed to set stat, unknown stat!');
    }

    if ($success) {
        if (set_stat($link, $name, $result[$name])) {
            db_log($link, $user, 'Session #'.$user['session'].' changed the '.$name.' stat to '.$value.'.');
        }
        return make_success();
    }

    return make_failure(ERROR_NO_CHANGE, 'Failed to set stat, value extraction failed.');
}

function fun_set_btc_txs($link, $user, $guid, $txs) {
    if ($guid === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.');
    if ($txs  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`txs` is invalid.');
    if (!has_access($link, $guid, ROLE_DECODER)) return make_failure(ERROR_MISUSE, 'Access denied!');
    if (is_paralyzed($link, $guid)) return make_failure(ERROR_NO_CHANGE, 'Failed to set transactions, session is paralyzed!');

    if (($c=count($txs)) > TXS_PER_QUERY) {
        return make_failure(ERROR_MISUSE, '`txs` contains '.$c.' elements exceeding the limit of '.TXS_PER_QUERY.'.');
    }

    $errno   = 0;
    $error   = '';
    $changes = 0;
    $added   = 0;
    $donation= 0;
    $spam    = 0;
    $spam_tx = null;
    foreach ($txs as $tx_hash => $data) {
        if ($data['conf'] === null) continue;

        $confirmed = 'FALSE';
        $amount    = null;
        $msg_type  = null;
        $fsize     = null;
        $msg_hash  = null;

        if ($data['conf'] > 0) $confirmed = 'TRUE';
        if ($data['amount'] !== null ) {
            $amount = $data['amount'];
            $donation += $amount;
        }
        if ($data['type']  !== null) $msg_type = $data['type'];
        if ($data['fsize'] !== null) $fsize    = $data['fsize'];

        if ($data['hash'] !== null) {
            $msg_hash = $data['hash'];

            // Spam protection only activates for transactions that have not made
            // a donation to cryptograffiti.info.
            if ($amount === null || $amount === 0) {
                // We first check if some TX already exists with the same message hash
                // but with a different transaction hash. If it does and it is not older
                // than 1 month then we are not allowing this TX in our database, to
                // avoid spam. Such spam can naturally happen if someone regularly
                // receives coins to an address that can be decoded as human readable
                // text. If same TX hash already exists in our DB with the same message
                // hash then we must treat this part of the request as an update instead
                // of ignoring it.
                //
                // Race condition BUG here:
                // If another set_btc_txs request is made right after the following
                // query and it adds a different TX with the same msg_hash for the first
                // time then both TXs will be added to the DB. However, this behavior
                // can be tolerated here because such race conditions happen very rarely
                // and having a couple of duplicate messages now and then is not really
                // a big deal.

                $q = db_query($link, "SELECT `nr` FROM `btc_tx` WHERE `msg_hash` = X'".$msg_hash.
                                     "' AND `hash` != X'".$tx_hash."' AND `creation_time` IS NOT NULL AND".
                                     " `creation_time` > (NOW() - INTERVAL 30 day) LIMIT 1");
                if ($q['errno'] === 0) {
                    if ($q['result']->fetch_assoc()) {
                        // Some other TX already exists with the same hash. Ignore this TX.
                        $spam++;
                        $spam_tx = $tx_hash;
                        continue;
                    }
                }
                else {
                    $errno = $q['errno'];
                    $error = $q['error'];
                    if ($errno !== 0) set_critical_error($link);
                    continue;
                }
            }
        }

        $nr = insert_hex_unique($link, 'btc_tx', array('hash' => $tx_hash));
        if ($nr !== null) {
            $added++;

            $query_string = "UPDATE `btc_tx` SET ".
                         "`confirmed` = ".$confirmed.", ".
                         ($amount   !== null ? "`amount` = '".$amount."', "      : "").
                         ($msg_type !== null ? "`type` = '".$msg_type."', "      : "").
                         ($fsize    !== null ? "`fsize` = '".$fsize."', "        : "").
                         ($msg_hash !== null ? "`msg_hash` = X'".$msg_hash."', " : "").
                         "`creation_time` = NOW() WHERE `nr` = '".$nr."'";
            $link->query($query_string);
            $errno = $link->errno;
            $error = $link->error;
            if ($fsize !== null && $msg_type === null) db_log($link, $user, "Query setting fsize without mime type: ".$query_string, LOG_ERROR);
            if ($link->affected_rows === 0) set_critical_error($link);
        }
        else {
            $query_string = "UPDATE `btc_tx` SET ".
                         ($amount   !== null ? "`amount` = '".$amount."', "      : "").
                         ($msg_type !== null ? "`type` = '".$msg_type."', "      : "").
                         ($fsize    !== null ? "`fsize` = '".$fsize."', "        : "").
                         ($msg_hash !== null ? "`msg_hash` = X'".$msg_hash."', " : "").
                         "`confirmed` = ".$confirmed." ".
                         "WHERE `hash` = X'".$tx_hash."'";
            $link->query($query_string);
            $errno = $link->errno;
            $error = $link->error;
            if ($link->affected_rows !== 0) {
                db_log($link, $user, $query_string);
                $changes++;
            }
        }
    }

    db_log($link, $user, 'Added '.$added.', updated '.$changes.' Bitcoin transaction'.($changes === 1 ? '.' : 's.'));
    if ($spam > 0) {
        if ($spam === 1) db_log($link, $user, 'Ignored 1 BTC TX '.$spam_tx.' (spam detected).');
        else             db_log($link, $user, 'Ignored '.$spam.' BTC TXs (spam detected).');
    }

    if ($donation > 0) {
        $donations_before = intval(get_stat($link, 'btc_donations'));
        $donations_after  = $donations_before;
        $result = $link->query("SELECT SUM(`amount`) AS `donations` FROM `btc_tx`");
             if ($link->errno !== 0) set_critical_error($link, $link->error);
        else if ($row = $result->fetch_assoc()) {
            $donations_after = intval($row['donations']);
        }

        if ($donations_after !== $donations_before) {
            set_stat($link, "btc_donations", $donations_after);
            if ($donations_before < $donations_after) {
                $new_donations = $donations_after - $donations_before;
                $new_donations/= SATOSHIS_PER_BITCOIN;
                $donation     /= SATOSHIS_PER_BITCOIN;
                if ($donations_before === 0) {
                    db_log($link, $user, 'Received a donation of '.sprintf("%.8f", $donation).' BTC.', LOG_FINANCIAL);
                }
                else {
                    db_log($link, $user, 'Received a donation of '.sprintf("%.8f", $new_donations).' BTC.', LOG_FINANCIAL);
                }
            }
        }
    }

    if ($errno !== 0) return make_failure(ERROR_SQL, $error);
    return make_success();
}

function fun_set_graffiti($link, $user, $guid, $graffiti) {
    if ($guid      === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`guid` is invalid.');
    if ($graffiti  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`graffiti` is invalid.');
    if (!has_access($link, $guid, ROLE_DECODER)) return make_failure(ERROR_MISUSE, 'Access denied!');
    if (is_paralyzed($link, $guid)) return make_failure(ERROR_NO_CHANGE, 'Failed to set graffiti, session is paralyzed!');

    if (($c=count($txs)) > TXS_PER_QUERY) {
        return make_failure(ERROR_MISUSE, '`txs` contains '.$c.' elements exceeding the limit of '.TXS_PER_QUERY.'.');
    }

    $errno      = 0;
    $error      = '';
    $spam_count = 0;
    $spam_txid  = null;
    $changes    = 0;
    $added      = 0;

    foreach ($graffiti as $tx_hash => $tx) {
        $spam = true;

        foreach ($tx['files'] as $file) {
            $qstr = "SELECT `nr` FROM `graffiti` WHERE `hash` = X'"
                   .$file['hash']."' AND `txid` != X'".$tx_hash
                   ."' AND `created` IS NOT NULL AND"
                   ." `created` > (NOW() - INTERVAL 30 day) LIMIT 1";
            $q = db_query($link, $qstr);

            if ($q['errno'] === 0) {
                if ($q['result']->fetch_assoc()) {
                    // Some other TX already exists with the same hash. Ignore this TX.
                    continue;
                }
                else {
                    $spam = false;
                    break;
                }
            }
            else {
                $errno = $q['errno'];
                $error = $q['error'];
                if ($errno !== 0) set_critical_error($link);
                continue;
            }
        }

        if ($spam === true) {
            $spam_count++;
            $spam_txid = $tx_hash;
            continue;
        }

        foreach ($tx['files'] as $file) {
            $nr = insert_unique_graffiti(
                $link,
                'graffiti',
                $tx_hash,
                $file['location'],
                $file['offset']
            );

            if ($nr !== null) {
                $added++;

                $query_string =
                    "UPDATE `graffiti` SET ".
                    "`fsize` = '".$file['fsize']."', ".
                    "`mimetype` = '".$file['type']."', ".
                    "`hash` = X'".$file['hash']."', ".
                    "`created` = NOW() WHERE `nr` = '".$nr."'";
                $link->query($query_string);
                $errno = $link->errno;
                $error = $link->error;
                if ($link->affected_rows === 0) set_critical_error($link);
            }
            else {
                $query_string =
                    "UPDATE `graffiti` SET ".
                    "`fsize` = '".$file['fsize']."', ".
                    "`mimetype` = '".$file['type']."', ".
                    "`hash` = X'".$file['hash']."' ".
                    "WHERE `txid` = X'".$tx_hash."'".
                    " AND `location` = '".$file['location']."'".
                    " AND `offset` = '".$file['offset']."'";
                $link->query($query_string);
                $errno = $link->errno;
                $error = $link->error;
                if ($link->affected_rows !== 0) {
                    db_log($link, $user, $query_string);
                    $changes++;
                }
            }
        }
    }

    db_log($link, $user, 'Added '.$added.', updated '.$changes.' graffiti row'.($changes === 1 ? '.' : 's.'));
    if ($spam_count > 0) {
        if ($spam_count === 1) db_log($link, $user, 'Ignored the graffiti from TX '.$spam_txid.' (spam detected).');
        else                   db_log($link, $user, 'Ignored '.$spam_count.' graffiti TXs (spam detected).');
    }

    if ($errno !== 0) return make_failure(ERROR_SQL, $error);
    return make_success();
}


function fun_get_msg_metadata($link, $user, $guid, $txids) {
    if ($txids  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`txids` is invalid.');

    $c = count($txids);
    if ($c > TXS_PER_QUERY) return make_failure(ERROR_MISUSE, '`txids` contains '.$c.' elements exceeding the limit of '.TXS_PER_QUERY.'.');

    $response = array();

    if ($c <= 0) {
        $response['payload'] = json_decode("[]");
        return make_success($response);
    }

    $buffer =array();
    $payload=array();
    $hashes =array();
    foreach ($txids as $index => $hash) {
        $hashes[] = "X'".$hash."'";
    }

    $query = "SELECT *, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation` ".
             "FROM `btc_tx` WHERE `hash` IN (".implode(',',$hashes).")";

    $result = $link->query($query);
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $hash = bin2hex($row['hash']);
            $buffer[$hash] = array("nr"            => $row['nr'],
                                   "type"          => $row['type'],
                                   "fsize"         => $row['fsize'],
                                   "amount"        => $row['amount'],
                                   "confirmed"     => $row['confirmed'],
                                   "creation_UTC"  => $row['utc_creation']
                                  );
        }
        $result->free();

        foreach ($txids as $index => $hash) {
            if (array_key_exists($hash, $buffer)) $payload[] = $buffer[$hash];
            else                                  $payload[] = null;
        }
        $response['payload'] = $payload;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    return make_success($response);
}

function fun_get_btc_graffiti($link, $user, $guid, $graffiti_nr, $count, $back, $mimetype) {
    if ($count  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`count` is invalid.');

    if ($mimetype !== null) $mimetype = $link->real_escape_string($mimetype);

    $limit = intval(min(intval($count), TXS_PER_QUERY));

    $response = array('txs' => null);
    $graffiti = array();

    if ($limit <= 0) return make_success($response);

    $where = "";
    $query = null;

    if ($graffiti_nr === null) {
        if ($mimetype !== null) $where = "WHERE `type` LIKE '".$mimetype."%'";
        $query = "SELECT *, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation` ".
                 "FROM `btc_tx` ".$where." ORDER BY `nr` DESC LIMIT ".$limit;
    }
    else if ($back === '1') {
        if ($mimetype !== null) $where = "AND `type` LIKE '".$mimetype."%'";
        $query = "SELECT *, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation` ".
                 "FROM `btc_tx` WHERE `nr` <= '".$graffiti_nr."' ".$where." ORDER BY `nr` DESC LIMIT ".$limit;
    }
    else if ($back === '0' || $back === null) {
        if ($mimetype !== null) $where = "AND `type` LIKE '".$mimetype."%'";
        $query = "SELECT *, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation` ".
                 "FROM `btc_tx` WHERE `nr` >= '".$graffiti_nr."' ".$where." ORDER BY `nr` ASC LIMIT ".$limit;
    }

    if ($query === null) {
        return make_failure(ERROR_INTERNAL, 'Unexpected program flow.');
    }

    $result = $link->query($query);
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $graffiti[] = array("nr"            => $row['nr'],
                                "type"          => $row['type'],
                                "fsize"         => $row['fsize'],
                                "amount"        => $row['amount'],
                                "txid"          => bin2hex($row['hash']),
                                "confirmed"     => $row['confirmed'],
                                "creation_UTC"  => $row['utc_creation']
                               );
        }
        $result->free();
        $response['txs'] = $graffiti;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    if ($graffiti_nr === null && is_array($response['txs'])) $response['txs'] = array_reverse($response['txs']);

    return make_success($response);
}

function fun_get_graffiti($link, $user, $guid, $graffiti_nr, $count, $back, $mimetype) {
    if ($count  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`count` is invalid.');

    if ($mimetype !== null) $mimetype = $link->real_escape_string($mimetype);

    $limit = intval(min(intval($count), ROWS_PER_QUERY));

    $response = array('rows' => null);
    $graffiti = array();

    if ($limit <= 0) return make_success($response);

    $where = "";
    $query = null;

    if ($graffiti_nr === null) {
        if ($mimetype !== null) $where = "WHERE `mimetype` LIKE '".$mimetype."%'";
        $query = "SELECT * ".
                 "FROM `graffiti` ".$where." ORDER BY `nr` DESC LIMIT ".$limit;
    }
    else if ($back === '1') {
        if ($mimetype !== null) $where = "AND `mimetype` LIKE '".$mimetype."%'";
        $query = "SELECT * ".
                 "FROM `graffiti` WHERE `nr` <= '".$graffiti_nr."' ".$where." ORDER BY `nr` DESC LIMIT ".$limit;
    }
    else if ($back === '0' || $back === null) {
        if ($mimetype !== null) $where = "AND `mimetype` LIKE '".$mimetype."%'";
        $query = "SELECT * ".
                 "FROM `graffiti` WHERE `nr` >= '".$graffiti_nr."' ".$where." ORDER BY `nr` ASC LIMIT ".$limit;
    }

    if ($query === null) {
        return make_failure(ERROR_INTERNAL, 'Unexpected program flow.');
    }

    $result = $link->query($query);
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $graffiti[] = array("nr"            => $row['nr'],
                                "location"      => $row['location'],
                                "mimetype"      => $row['mimetype'],
                                "fsize"         => $row['fsize'],
                                "offset"        => $row['offset'],
                                "txid"          => bin2hex($row['txid']),
                                "hash"          => bin2hex($row['hash'])
                               );
        }
        $result->free();
        $response['rows'] = $graffiti;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    if ($graffiti_nr === null && is_array($response['rows'])) $response['rows'] = array_reverse($response['rows']);

    return make_success($response);
}

function fun_get_btc_donations($link, $user, $guid, $graffiti_nr, $count, $back, $mimetype) {
    if ($count  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`count` is invalid.');

    if ($mimetype !== null) $mimetype = $link->real_escape_string($mimetype);

    $limit = intval(min(intval($count), TXS_PER_QUERY));

    $response = array('txs' => null);
    $graffiti = array();

    if ($limit <= 0) return make_success($response);

    $where = "";
    $query = null;
    if ($mimetype !== null) $where = "AND `type` LIKE '".$mimetype."%'";

    if ($graffiti_nr === null) {
        $query = "SELECT *, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation` ".
                 "FROM `btc_tx` WHERE `amount` >= '".MIN_BTC_DONATION."' ".$where." ORDER BY `amount` DESC LIMIT ".$limit;
    }
    else if ($back === '1') {
        $query = "SELECT *, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation` ".
                 "FROM `btc_tx` WHERE `nr` <= '".$graffiti_nr."' AND `amount` >= '".MIN_BTC_DONATION."' ".$where." ORDER BY `nr` DESC LIMIT ".$limit;
    }
    else if ($back === '0' || $back === null) {
        $query = "SELECT *, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation` ".
                 "FROM `btc_tx` WHERE `nr` >= '".$graffiti_nr."' AND `amount` >= '".MIN_BTC_DONATION."' ".$where." ORDER BY `nr` ASC LIMIT ".$limit;
    }

    if ($query === null) {
        return make_failure(ERROR_INTERNAL, 'Unexpected program flow.');
    }

    $result = $link->query($query);
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $graffiti[] = array("nr"            => $row['nr'],
                                "type"          => $row['type'],
                                "fsize"         => $row['fsize'],
                                "amount"        => $row['amount'],
                                "txid"          => bin2hex($row['hash']),
                                "confirmed"     => $row['confirmed'],
                                "creation_UTC"  => $row['utc_creation']
                               );
        }
        $result->free();
        $response['txs'] = $graffiti;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    if ($graffiti_nr === null && is_array($response['txs'])) $response['txs'] = array_reverse($response['txs']);

    return make_success($response);
}

function fun_get_orders($link, $user, $guid, $group, $order_nr, $count, $back, $accepted, $filled, $executive) {
    if ($group === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`group` is invalid.');
    if ($count === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`count` is invalid.');

    $limit = intval(min(intval($count), ORDERS_PER_QUERY));

    $response = array('orders' => null);
    $orders = array();

    if ($limit <= 0 || is_paralyzed($link, $guid)) return make_success($response);

    $inc = '';
         if ($accepted === '0') $inc .= " AND `accepted` IS FALSE";
    else if ($accepted === '1') $inc .= " AND `accepted` IS TRUE";
         if ($filled   === '0') $inc .= " AND `filled` IS FALSE";
    else if ($filled   === '1') $inc .= " AND `filled` IS TRUE";

    if ($executive !== null) $inc .= " AND `executive` = '".$executive."'";

    $sel   = "`nr`, `group`, `executive`, `accepted`, `filled`, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation`";
    $query = "SELECT ".$sel." FROM `order` WHERE `nr` >= '".$order_nr."' AND `group` = '".$group."'".$inc." ORDER BY `nr` ASC LIMIT ".$limit;

    if ($order_nr === null) {
        $query = "SELECT ".$sel." FROM `order` WHERE `group` = '".$group."'".$inc." ORDER BY `nr` DESC LIMIT ".$limit;
    }
    else if ($back === '1') {
        $query = "SELECT ".$sel." FROM `order` WHERE `nr` <= '".$order_nr."' AND `group` = '".$group."'".$inc." ORDER BY `nr` DESC LIMIT ".$limit;
    }

    $result = $link->query($query);
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $orders[]   = array("nr"            => $row['nr'],
                                "group"         => $row['group'],
                                "executive"     => $row['executive'],
                                "utc_creation"  => $row['utc_creation'],
                                "accepted"      => $row['accepted'],
                                "filled"        => $row['filled']
                               );
        }
        $result->free();
        $response['orders'] = $orders;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    if ($order_nr === null && is_array($response['orders'])) $response['orders'] = array_reverse($response['orders']);

    return make_success($response);
}

function fun_get_order($link, $user, $guid, $order_nr, $inclusive) {
    if (is_paralyzed($link, $guid)) return make_failure(ERROR_ACCESS_DENIED, 'Failed to get order, session is paralyzed!');

    if ($order_nr  === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`nr` is invalid.');
    if ($inclusive === null) $inclusive = '0';
    else if ($inclusive === '1') {
        if (!has_access($link, $guid, ROLE_EXECUTIVE)) {
            return make_failure(ERROR_MISUSE, 'Access denied! Your session has no privileges for inclusively getting an order.');
        }
    }
    $sel   = "`nr`, `group`, `executive`, `accepted`, `filled`, CONVERT_TZ(`creation_time`, @@session.time_zone, '+00:00') AS `utc_creation`, "
           . "`output`".($inclusive === '1' ? ', `input`' : '');

    $query = "SELECT ".$sel." FROM `order` WHERE `nr` = '".$order_nr."'";

    $order = array();
    $result = $link->query($query);
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $order   = array("nr"            => $row['nr'],
                             "group"         => $row['group'],
                             "executive"     => $row['executive'],
                             "utc_creation"  => $row['utc_creation'],
                             "accepted"      => $row['accepted'],
                             "filled"        => $row['filled'],
                             "input"         => $row['input'],
                             "output"        => $row['output']
                            );
        }
        $result->free();

        if (is_string($order['input'])) {
            $arr = json_decode($order['input'], true, 8);
            if (is_array($arr)) {
                $order['input'] = $arr;
            }
            else unset($order['input']);
        }
        else unset($order['input']);

        $response['order'] = $order;
    }
    else {
        return make_failure(ERROR_SQL, $link->error);
    }

    return make_success($response);
}

function fun_send_mail($link, $user, $guid, $to, $subj, $msg, $headers) {
    if (!has_access($link, $guid, ROLE_DECODER)
    &&  !has_access($link, $guid, ROLE_MONITOR)
    &&  !has_access($link, $guid, ROLE_EXECUTIVE)) {
        return make_failure(ERROR_MISUSE, 'Access denied!');
    }

    if ($to      === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`to` is invalid.');
    if ($subj    === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`subj` is invalid.');
    if ($msg     === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`msg` is invalid.');
    if ($headers === null) return make_failure(ERROR_INVALID_ARGUMENTS, '`headers` is invalid.');

    $sz = sprintf("%.4f", strlen($msg)/1024.0);

    $sql_to   = $link->real_escape_string($to);
    $sql_subj = $link->real_escape_string($subj);
    db_log($link, null, 'Sending `'.$sql_subj.'` e-mail to '.$sql_to.' ('.$sz.' KiB).', LOG_NORMAL);
    if (!mail($to,$subj,$msg,$headers)) {
        return make_failure(ERROR_INTERNAL, 'Failed to send e-mail.');
    }

    return make_success();
}

function fun_default($link, $user) {
    $task = $_POST['task'];
    $pass = $_POST['pass'];
    $T    = isset($_POST['T']) ? intval($_POST['T']) : 1;

    if ($pass !== CRON_PASSWORD) return make_failure(ERROR_MISUSE, 'Missing `fun` parameter.');

    switch ($task) {
        case 'cron_day'    : return cron_day($link);       break;
        case 'cron_alarm'  : return cron_alarm($link, $T); break;
        default            : return null;                  break;
    }
}

// curl --connect-timeout 300 --silent -d "task=cron_alarm&pass=CRON_PASSWORD_HERE&T=5" -X POST 'https://cryptograffiti.info/api/'
function cron_alarm($link, $T) {
    db_log($link, null, 'CRON T'.$T.' alarm signal received.', LOG_MINOR);

    $alarm_time = microtime(true);
    $overload = false;
    $PPM = 20; // Pulse Per Minute
    for ($t = 0; $t < $T; $t++) {
        cron_tick($link);

        for ($i = 0; $i < $PPM; $i++) {
            $time_start = microtime(true);

            if ($overload) {
                increase_stat($link, "overload");
                $overload = false;
            }

            cron_pulse($link);

            if ($i+1 < $PPM || $t+1 < $T) {
                $time_end = microtime(true);
                $time = (60/$PPM)*1000000 - round(1000000*($time_end - $time_start));
                if ($time > 0) usleep($time);
                else $overload = true;
            }
        }
    }

    $alarm_time = microtime(true) - $alarm_time;

    db_log($link, null, 'CRON T'.$T.' alarm sequence ends ('.round($alarm_time, 2).' s).', LOG_MINOR);
    return make_success();
}

function cron_pulse($link) {
    // Inactive or abused captchas get fused/deleted so that the user must solve a new CAPTCHA
    // Avoid fusing such captchas that haven't been updated within the last 30 seconds because
    // in that case our CRON tick might not be working as expected.
    $link->query("UPDATE `captcha` SET `fused` = TRUE WHERE `rpm` > `max_rpm` AND `last_update` > ( NOW() - INTERVAL 30 second )");
    if ( ($ar = $link->affected_rows) > 0) {
        db_log($link, null, $ar.' token'.($ar == 1 ? '' : 's').' fused due to excess RPM.');
    }

    increase_stat($link, "steps");
}

function http_get($url, $params=array()) {
    $url = $url.'?'.http_build_query($params, '', '&');
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);
    return $response;
}

// curl --connect-timeout 300 --silent -d "task=cron_tick&pass=CRON_PASSWORD_HERE&T=5" -X POST 'https://amaraca.com/db/'
function cron_tick($link) {
    $IPs    = 0;
    $result = $link->query("SELECT COUNT(`ip`) AS `IPs` FROM `address` WHERE `rpm` > 0");

         if ($link->errno !== 0) set_critical_error($link, $link->error);
    else if ($row = $result->fetch_assoc()) {
        $IPs = intval($row['IPs']);
    }

    $result = $link->query("SELECT COUNT(`nr`) AS `sessions` FROM `session` WHERE `end_time` IS NULL");


         if ($link->errno !== 0) set_critical_error($link, $link->error);
    else if ($row = $result->fetch_assoc()) {
        // Race condition BUG here: if CURDATE() changes before the next query then the next query has no effect.
        $query = "UPDATE `stats` SET `updates` = `updates` + '1', `IPs` = '".$IPs."', `sessions` = '".intval($row['sessions']).
                 "', `max_IPs` = IF (`max_IPs` < '".$IPs."', '".$IPs.
                 "', `max_IPs`), `max_sessions` = IF (`max_sessions` < '".intval($row['sessions'])."', '".intval($row['sessions']).
                 "', `max_sessions`), `free_tokens` = '0' WHERE `date` = CURDATE()";
        $link->query($query);
        if ($link->errno !== 0) set_critical_error($link, $link->error);
        else {
            if ($link->affected_rows === 0) {
                db_log($link, null, "Failed to update stats. Inserting a new row for the current date.");
                $link->query("INSERT IGNORE INTO `stats` (`date`) VALUES(CURDATE())");
                if ($link->errno !== 0) set_critical_error($link, $link->error);
                if ($link->affected_rows === 0) {
                    db_log($link, null, "Failed to insert a new row to `stats`.", LOG_ERROR);
                }
            }
        }
    }

    // Make sure donations are up to date:
    $result = $link->query("SELECT SUM(`amount`) AS `donations` FROM `btc_tx`");
    if ($link->errno !== 0) set_critical_error($link, $link->error);
    else if ($row = $result->fetch_assoc()) {
        $donations = intval($row['donations']);
        set_stat($link, "btc_donations", $donations);
    }

    // Inactive captchas get deleted so that the user must solve a new CAPTCHA
    $link->query(
        "DELETE FROM `captcha` WHERE (`sticky` IS FALSE AND `last_update` < ( NOW() - INTERVAL ".CAPTCHA_TIMEOUT." second ) )"
    );
    if ( ($ar = $link->affected_rows) > 0) {
        db_log($link, null, $ar.' CAPTCHA'.($ar == 1 ? '' : 's').' deleted for being unused for '.CAPTCHA_TIMEOUT.' seconds.');
    }
    $link->query("DELETE FROM `captcha` WHERE `fused` IS TRUE AND `sticky` IS FALSE");
    if ( ($ar = $link->affected_rows) > 0) {
        db_log($link, null, $ar.' fused token'.($ar == 1 ? '' : 's').' deleted.');
    }

    $link->query("UPDATE `address` SET `rpm` = '0' WHERE `rpm` > '0'");
    $link->query("UPDATE `address` SET `max_rpm` = DEFAULT(`max_rpm`) WHERE `max_rpm` > DEFAULT(`max_rpm`)");
    $link->query("UPDATE `captcha` SET `rpm` = '0' WHERE `rpm` > '0'");
    $link->query("UPDATE `address` SET `free_tokens` = '0' WHERE `free_tokens` > '0'");

    $link->query(
        "UPDATE `session` SET `end_time` = NOW() ".
        "WHERE `end_time` IS NULL ".
        "AND (`last_request` IS NULL OR `last_request` < (NOW() - INTERVAL ".SESSION_TIMEOUT." second))"
    );
    $link->query(
        "UPDATE `session` SET `end_time` = NULL, `start_time` = NOW() ".
        "WHERE `end_time` IS NOT NULL ".
        "AND `last_request` IS NOT NULL ".
        "AND `last_request` > `end_time`"
    );

    {
        // Check which critical fused sessions have appeared online lately:
        $result = $link->query("SELECT `nr`, `alias` FROM `session` WHERE (`flags` & '".FLAG_CRITICAL."') AND (`flags` & '".FLAG_FUSED.
                               "') AND (`end_time` IS NULL OR `end_time` > (NOW() - INTERVAL 3600 second))");
        if ($link->errno === 0) {
            while ($row = $result->fetch_assoc()) {
                $link->query("UPDATE `session` SET `flags` = `flags` & ~".FLAG_FUSED." WHERE `nr` = '".$row['nr']."'");
                if ($link->errno === 0) {
                    $text = "Session #".$row['nr'].($row['alias'] === null ? ' ' : ' ('.$row['alias'].') ').
                            "appears to be online.";
                    db_log($link, null, $text, LOG_CRITICAL);
                }
                else set_critical_error($link, $link->error);
            }
        }
        else set_critical_error($link, $link->error);

        // Check which critical sessions have appeared offline lately and fuse them:
        $result = $link->query("SELECT `nr`, `alias` FROM `session` WHERE (`flags` & '".FLAG_CRITICAL."') AND NOT (`flags` & '".FLAG_FUSED.
                               "') AND (`end_time` IS NOT NULL AND `end_time` <= (NOW() - INTERVAL 3600 second))");
        if ($link->errno === 0) {
            while ($row = $result->fetch_assoc()) {
                $link->query("UPDATE `session` SET `flags` = `flags` | ".FLAG_FUSED." WHERE `nr` = '".$row['nr']."'");
                if ($link->errno === 0) {
                    $text = "Session #".$row['nr'].($row['alias'] === null ? ' ' : ' ('.$row['alias'].') ').
                            "appears to be offline.";
                    db_log($link, null, $text, LOG_CRITICAL);
                }
                else set_critical_error($link, $link->error);
            }
        }
        else set_critical_error($link, $link->error);

        // Check if decoding works right now:
        $result = $link->query("SELECT `nr` FROM `session` WHERE (`role` & '".ROLE_DECODER.
                               "') AND `end_time` IS NULL OR `end_time` > (NOW() - INTERVAL 120 second) LIMIT 1");
        if ($link->errno === 0) {
            $decoder_before = get_stat($link, 'decoder');

            if ( ($row = $result->fetch_assoc()) ) {
                // Decoder is online
                if ($decoder_before === '0') {
                    set_stat($link, "decoder", '1');
                    db_log($link, null, 'Cryptograffiti decoding is now enabled.', LOG_CRITICAL);
                }
            }
            else {
                // Decoder is offline
                if ($decoder_before === '1') {
                    set_stat($link, "decoder", '0');
                    db_log($link, null, 'Cryptograffiti decoding appears disabled!', LOG_CRITICAL);
                }
            }
        }
        else set_critical_error($link, $link->error);

        // Check if encoding works right now:
        $result = $link->query("SELECT `nr` FROM `session` WHERE (`role` & '".ROLE_ENCODER.
                               "') AND `end_time` IS NULL OR `end_time` > (NOW() - INTERVAL 120 second) LIMIT 1");
        if ($link->errno === 0) {
            $encoder_before = get_stat($link, 'encoder');

            if ( ($row = $result->fetch_assoc()) ) {
                // Encoder is online
                if ($encoder_before === '0') {
                    set_stat($link, "encoder", '1');
                    db_log($link, null, 'Cryptograffiti encoding is now enabled.', LOG_CRITICAL);
                }
            }
            else {
                // Encoder is offline
                if ($encoder_before === '1') {
                    set_stat($link, "encoder", '0');
                    db_log($link, null, 'Cryptograffiti encoding appears disabled!', LOG_CRITICAL);
                }
            }
        }
        else set_critical_error($link, $link->error);
    }
}

//curl --connect-timeout 60 --silent 'http://www.cryptograffiti.info/database/index.php?task=cron_day&pass=NZQAtEYE3gYG' >/dev/null 2>&1
function cron_day($link) {
    db_log($link, null, 'CRON day event starts ('.$_SERVER['REQUEST_TIME'].').', LOG_MINOR);
    $errors = 0;

    db_log($link, null, 'Checking log table for errors.', LOG_NORMAL);

    $result = $link->query("SELECT `creation_time`, `text`, `line`, `file` FROM `log` ".
                           "WHERE `level` >= '".LOG_ERROR."' AND `creation_time` IS NOT NULL AND ".
                           "`creation_time` >= (NOW() - INTERVAL 24 hour) ORDER BY `nr` ASC LIMIT 50");

    $message = '';
    if ($link->errno === 0) {
        while ($row = $result->fetch_assoc()) {
            $message.=$row['creation_time'].' : '.$row['text'].' ('.$row['file'].':'.$row['line'].")\n";
            $errors++;
        }
    }
    else set_critical_error($link, $link->error);


    if ($errors > 0) {
        $to = "hyena@hyena.net.ee";
        $subject = "CGD ERROR";
        $from = "Error@CryptoGraffiti.info";
        $headers = "From:" . $from;

        db_log($link, null, 'E-mailing '.$errors.' error'.($errors == 1 ? '' : 's').' to '.$to.'.', LOG_NORMAL);
        mail($to,$subject,$message,$headers);
    }

    $link->query("DELETE FROM `log` WHERE `creation_time` IS NOT NULL AND `creation_time` < (NOW() - INTERVAL 30 day)");
    if ($link->errno === 0) {
        $ar = $link->affected_rows;
        if ($ar > 0) {
            db_log($link, null, 'Deleted '.$ar.' old log'.($ar == 1 ? '' : 's').'.', LOG_NORMAL);
        }
    }
    else set_critical_error($link, $link->error);

    db_log($link, null, 'CRON day event ends ('.$_SERVER['REQUEST_TIME'].').', LOG_MINOR);
    return make_success();
}

function has_access($link, $guid, $role) {
    $session_role = get_session_variable($link, $guid, 'role');

    $match = intval($role) & intval($session_role);
    if ($match === intval($role)) return true;

    return false;
}

function is_paralyzed($link, $guid) {
    $flags = get_session_variable($link, $guid, 'flags');

    $match = intval(FLAG_PARALYZED) & intval($flags);
    if ($match === intval(FLAG_PARALYZED)) return true;

    return false;
}

function db_query($link, $query) {
    $result = $link->query($query);
    return array('affected_rows' => $link->affected_rows,
                 'error'         => $link->error,
                 'errno'         => $link->errno,
                 'result'        => $result);
}

function lock_record($link, $table, $nr, $user = null) {
    $link->query("UPDATE `".$table."` SET `locked` = '1' WHERE `nr` = '".$nr."' AND `locked` = '0'");

    if ($link->errno !== 0) {
        db_log($link, $user, $link->error, LOG_CRITICAL);
        return false;
    }

    if ($link->affected_rows > 0) {
        db_log($link, $user, 'Locked record #'.$nr.' in `'.$table.'` table.');
        return true;
    }
    db_log($link, $user, 'Failed to lock record #'.$nr.' in `'.$table.'` table.', LOG_NORMAL);
    return false;
}

function unlock_record($link, $table, $nr, $user = null) {
    $link->query("UPDATE `".$table."` SET `locked` = '0' WHERE `nr` = '".$nr."' AND `locked` = '1'");

    if ($link->errno !== 0) {
        db_log($link, $user, $link->error, LOG_CRITICAL);
        return false;
    }

    if ($link->affected_rows > 0) {
        db_log($link, $user, 'Unlocked record #'.$nr.' in `'.$table.'` table.');
        return true;

    }
    db_log($link, $user, 'Failed to unlock record #'.$nr.' in `'.$table.'` table.', LOG_NORMAL);
    return false;
}

function db_log($link, $user, $body, $level = LOG_MINOR) {
    $bt        = debug_backtrace();
    $caller    = array_shift($bt);
    $file      = $caller['file'];
    $info      = pathinfo($file);
    $file_name = basename($file,'.'.$info['extension']);
    $line      = $caller['line'];

    if ($level < 0) $level = 0;
    else            $level = intval($level);

    if (is_array($body)
    &&  array_key_exists('error', $body)
    &&  is_array($body['error'])
    &&  array_key_exists('message', $body['error'])
    &&  array_key_exists('file',    $body['error'])
    &&  array_key_exists('line',    $body['error'])
    &&  array_key_exists('code',    $body['error'])) {
        $body = /*$body['error']['code'].': '.*/$body['error']['message'].' ('.$body['error']['file'].': line '.$body['error']['line'].')';
    }
    else if (!is_string($body)){
        $body = 'BAD FORMAT';
        set_critical_error($link);
    }

    $insert = array('file'       => $file_name,
                    'line'       => $line,
                    'level'      => $level,
                    'text'       => $body
                   );

    if (is_array($user)) {
        if (array_key_exists('ip',      $user) && is_string($user['ip'     ])) $insert['ip'        ] = $user['ip'     ];
        if (array_key_exists('session', $user) && is_num   ($user['session'])) $insert['session_nr'] = $user['session'];
        if (array_key_exists('fun',     $user) && is_string($user['fun'    ])) $insert['fun'       ] = $user['fun'    ];
    }

    insert_entry($link, 'log', $insert);
}

?>
