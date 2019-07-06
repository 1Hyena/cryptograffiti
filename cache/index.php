<?php
header('Content-Type:text/plain');

if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    header('Allow:POST');
    http_response_code(405);
    print "METHOD NOT ALLOWED";
    exit;
}

$size = (int) $_SERVER['CONTENT_LENGTH'];
if ($size === 0) {
    http_response_code(400);
    print "EMPTY POST BODY";
    exit;
}
$postdata = file_get_contents("php://input");
$hash = hash("ripemd160", $postdata, false);

if (strlen($hash) !== 40) {
    http_response_code(500);
    print "INTERNAL ERROR (".__LINE__.")";
    exit;
}

{
    require('../api/auth.php');

    $host     = SQL_HOST;
    $username = SQL_USERNAME;
    $password = SQL_PASSWORD;
    $db_name  = SQL_DATABASE;

    // Connect to server and select databse.
    $link = new mysqli($host, $username, $password, $db_name);
    if ($link->connect_error) {
        http_response_code(500);
        print "INTERNAL ERROR (".__LINE__.")";
        exit;
    }

    $query="SELECT `nr` FROM `graffiti` WHERE `hash` = X'"
          .$link->real_escape_string($hash)."' LIMIT 1";

    {
        $result = $link->query($query);
        $errno  = $link->errno;
        $link->close();

        if ($errno === 0) {
            if ( !($row = $result->fetch_assoc()) ) {
                // Payload is not any of the known graffiti.
                http_response_code(400);
                print "UNKNOWN PAYLOAD";
                exit;
            }
        }
        else {
            http_response_code(500);
            print "INTERNAL ERROR (".__LINE__.")";
            exit;
        }
    }
}

$fname=$hash;

$fp = fopen($fname, "w");
if ($fp == false) {
    http_response_code(500);
    print "INTERNAL ERROR (".__LINE__.")";
    exit;
}

fwrite($fp, $postdata);
fclose($fp);

http_response_code(201);
print $fname;
?>
