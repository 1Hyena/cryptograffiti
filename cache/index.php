<?php
function shutdown($link, $code, $text) {
    if ($link !== null) $link->close();
    header('Content-Type:text/plain');
    http_response_code($code);
    print $text;
    exit;
}

if ($_SERVER['REQUEST_METHOD'] != 'GET') {
    header('Allow:GET');
    shutdown(null, 405, "METHOD NOT ALLOWED");
}

$hash = isset($_GET['hash']) ? $_GET['hash'] : null;

if ($hash === null || strlen($hash) !== 40 || !ctype_xdigit($hash)) {
    shutdown(null, 404, "BAD PARAMETER");
}

require('../api/auth.php');

$host     = SQL_HOST;
$username = SQL_USERNAME;
$password = SQL_PASSWORD;
$db_name  = SQL_DATABASE;

// Connect to server and select databse.
$link = new mysqli($host, $username, $password, $db_name);
if ($link->connect_error) shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");

$query = (
    "SELECT `txid`, `location`, `fsize`, `offset`, `mimetype` ".
    "FROM `graffiti` WHERE `hash` = X'".$link->real_escape_string($hash).
    "' LIMIT 1"
);

$result = $link->query($query);
$errno  = $link->errno;

if ($errno === 0) {
    if (!($row = $result->fetch_assoc()) ) {
        shutdown($link, 404, "NOT FOUND");
    }

    $txid = bin2hex($row['txid']);
    $location = $row['location'];
    $fsize = intval($row['fsize']);
    $offset = intval($row['offset']);
    $mimetype = $row['mimetype'];

    if ($location !== "NULL_DATA") {
        shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
    }

    $rawtx = "../rawtx/".$txid;

    for ($retries = 10; $retries >= 0; $retries--) {
        if (file_exists($rawtx)) break;

        $retry = $retries > 0 ? true : false;

        $query = (
            "UPDATE `tx` SET `requests` = `requests` + 1, `cache` = FALSE ".
            "WHERE `txid` = X'".$link->real_escape_string($txid)."'"
        );

        $result = $link->query($query);
        $errno  = $link->errno;

        if ($errno === 0) {
            if ($link->affected_rows === 0) {
                shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
            }

            if ($retry) {
                usleep(1000000);
                continue;
            }

            header('Retry-After:5');
            shutdown($link, 503, "TRY AGAIN LATER");
        }

        shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
    }

    if (!file_exists($rawtx)) {
        $query = (
            "UPDATE `tx` SET `requests` = `requests` + 1, `cache` = FALSE ".
            "WHERE `txid` = X'".$link->real_escape_string($txid)."'"
        );

        $result = $link->query($query);
        $errno  = $link->errno;

        if ($errno === 0) {
            if ($link->affected_rows === 0) {
                shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
            }

            header('Retry-After:5');
            shutdown($link, 503, "TRY AGAIN LATER");
        }

        shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
    }

    if (filesize($rawtx) < $offset + $fsize) {
        shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
    }

    $fp = fopen($rawtx, "rb");
    if ($fp == false) {
        shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
    }

    if (fseek($fp, $offset) !== 0) {
        fclose($fp);
        shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
    }

    $chunks = array();
    $fsize_remaining = $fsize;

    while (!feof($fp)) {
        $chunk = fread($fp, $fsize_remaining);

        if ($chunk === false) {
            fclose($fp);
            shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");
        }

        $fsize_remaining -= strlen($chunk);
        $chunks[] = $chunk;

        if ($fsize_remaining <= 0) break;
    }

    fclose($fp);

    $link->close();

    header('Content-Type:'.$mimetype);
    header("Content-Length:".$fsize);
    http_response_code(200);
    echo implode($chunks);
    exit;
}

shutdown($link, 500, "INTERNAL ERROR (".__LINE__.")");

?>
