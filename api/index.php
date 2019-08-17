<?php

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $fname = './README.md';
    $fp = fopen($fname, 'rb');

    header("Content-Type: text/plain");
    header("Content-Length: " . filesize($fname));

    fpassthru($fp);
    exit;
}

require('./fun.php');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$IP = $_SERVER["REMOTE_ADDR"];
if (inet_pton ($_SERVER["REMOTE_ADDR"]) === false) {
    $err = make_failure(ERROR_INTERNAL, '`'.$IP.'` is unacceptable for your IP address.');
    echo json_encode($err);
    exit;
}

if (PHP_INT_SIZE < 8) {
    $err = make_failure(ERROR_INTERNAL, "Server's architecture cannot support Crypto Graffiti Decoder.");
    echo json_encode($err);
    exit;
}

$HTTPS   = true;
$ALS     = false;
$SEC_KEY = null;

if ((empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') && $_SERVER['SERVER_PORT'] !== 443) {
    $HTTPS = false;
}

if ($l = init_sql()) {
    $err_tables = assure_tables($l);
    if (is_array($err_tables)) {
        echo json_encode($err_tables);
        deinit_sql($l);
        exit;
    }

    $USER = array( 'ip'      => $IP,
                   'session' => null,
                   'tls'     => $HTTPS,
                   'als'     => false,
                   'fun'     => $l->real_escape_string($_POST['fun'])
                 );

    increase_stat($l, "database_requests");
    increase_addr_stat($l, $IP, "requests");
    $new_rpm = increase_addr_stat($l, $IP, "rpm");

    $api_usage = null;
    if (isset($_POST['token'])) {
        $token = $_POST['token'];
        $valid = false;
        if (strlen($token) === 64
        &&  ctype_xdigit($token)
        &&  ($api_usage = find_token($l, $token))) {
            $q = db_query($l, "UPDATE `captcha` SET `rpm` = `rpm` + '1' WHERE `fused` IS FALSE AND `token` = X'".$token."'");
            if ($q['errno'] === 0 && $q['affected_rows'] > 0) {
                $valid = true;
                increase_addr_stat($l, $IP, "max_rpm");
            }
        }

        if (!$valid) {
            if (get_addr_stat ($l, $IP, "banned")) {
                increase_stat($l, "banned_requests");
            }
            db_log($l, $USER, 'Invalid POST token: `'.$token.'`', LOG_MISUSE);
            $err = make_failure(ERROR_INVALID_ARGUMENTS, 'Invalid `token`.');
            echo json_encode($err);
            deinit_sql($l);
            exit;
        }
    }
    else {
        if (get_addr_stat ($l, $IP, "banned")) {
            increase_stat($l, "banned_requests");
            //db_log($l, $USER, 'Request rejected due to persistent IP ban.');
            $err = make_failure(ERROR_ACCESS_DENIED, '`'.$IP.'` is banned. Provide `token` to bypass the ban.');
            echo json_encode($err);
            deinit_sql($l);
            exit;
        }
        else {
            $rpm     = $new_rpm;
            $max_rpm = get_addr_stat ($l, $IP, "max_rpm");
            if ($rpm === null || $max_rpm === null) {
                $err = make_failure(ERROR_INTERNAL, 'Unable to count requests per minute.');
                echo json_encode($err);
                deinit_sql($l);
                exit;
            }

            $max_rpm = intval($max_rpm);
            if ($rpm > $max_rpm) {
                increase_stat($l, "banned_requests");
                if ($rpm === ($max_rpm+1)) {
                    db_log($l, $USER, 'IP '.$IP.' is temporarily banned.', LOG_MISUSE);
                    if (count($_REQUEST) > 0) {
                        $request = var_export(json_encode($_REQUEST), true);
                        db_log($l, $USER, "Abusive ".$_SERVER['REQUEST_METHOD']." request from ".$USER['ip'].":\n".$request, LOG_MISUSE);
                    }
                }
                $err = make_failure(
                           ERROR_ACCESS_DENIED,
                           '`'.$IP.'` is temporarily banned for making too many requests. Provide `token` to bypass the ban.'
                       );
                echo json_encode($err);
                deinit_sql($l);
                exit;
            }
            $api_usage = array("rpm" => $rpm, "max_rpm" => $max_rpm);
        }
    }

    if (isset($_POST['fun']) && $_POST['fun'] == 'get_captcha') {
        $date   = date("Ymd");
        $rand   = generateRandomString(16);
        $img    = $rand;
        $token  = hash("sha256", $img.CAPTCHA_SALT, false);
        $nr     = insert_hex_unique($l, 'captcha', array('token' => $token));

        if ($nr === null) {
            $err = make_failure(ERROR_NO_CHANGE, 'Failed to generate CAPTCHA, try again.');
            db_log($l, $USER, $err, LOG_ERROR);
            echo json_encode($err);
        }
        else if ($nr === false) {
            $err = make_failure(ERROR_BAD_TIMING, "Bad timing, please try again.");
            db_log($l, $USER, $err, LOG_ALERT);
            echo json_encode($err);
        }
        else {
            $ftoken = null;

            $ft_given_local  = get_addr_stat($l, $IP, 'free_tokens');
            $ft_given_global = get_stat     ($l,      'free_tokens');
            if ($ft_given_local  !== null && is_num($ft_given_local )
            &&  $ft_given_global !== null && is_num($ft_given_global)) {
                $ft_given_local = intval($ft_given_local);
                $ft_given_global= intval($ft_given_global);
                if ($ft_given_local < 3 && $ft_given_global < 30) {
                    $ftoken = $token;
                    db_log($l, $USER, 'Free token given out, binded to CAPTCHA #'.$nr.'.', LOG_NORMAL);
                    increase_addr_stat($l, $IP, 'free_tokens');
                    increase_stat     ($l, 'free_tokens');
                }
            }

            if ($ftoken === null) {
                db_log($l, $USER, 'Created a new CAPTCHA #'.$nr.'.', LOG_NORMAL);
            }

            $url = 'https://cryptograffiti.info/api/captcha.php?img='.$img;
            $result = make_success(array('captcha' => array('url' => $url,'img' => $img, 'token' => $ftoken)));
            echo json_encode($result);
        }

        deinit_sql($l);
        exit;
    }

    if (isset($_POST['fun']) && $_POST['fun'] == 'get_token') {
        $img  = $_POST['img'];
        $code = $_POST['code'];

        if (!is_captcha_str($img)
        ||  !is_captcha_str($code)) {
            $err = make_failure(ERROR_INVALID_ARGUMENTS, 'Invalid `img` or `code`.');
            db_log($l, $USER, $err, LOG_MISUSE);
            echo json_encode($err);
        }
        else {
            $token = hash("sha256", $img.CAPTCHA_SALT, false);

            if (strcasecmp(substr($token, 0, 5), $code) === 0) {
                $result = make_success(array('token' => $token));
                echo json_encode($result);
                db_log($l, $USER, 'Token given for solving a CAPTCHA.', LOG_NORMAL);
            }
            else {
                db_query($l, "DELETE FROM `captcha` WHERE `token` = X'".$token."' AND `sticky` IS FALSE");
                $err = make_failure(ERROR_MISUSE, 'Unexpected answer `'.$code.'` to a CAPTCHA `'.$img.'`. Related tokens invalidated.');
                db_log($l, $USER, $err, LOG_MISUSE);
                echo json_encode($err);
            }
        }

        deinit_sql($l);
        exit;
    }

    $fun      = $_POST['fun'];
    $data     = $_POST['data'];

    $r = null;

    if ( isset($_POST['sec_hash'])
    &&   isset($_POST['salt']    )
    &&   isset($_POST['checksum']) ) {
        $data = rawurldecode($data);
        // Application Layer Security:
        $result = ALS_extract($l, $fun, $data, $_POST['sec_hash'], $_POST['salt'], $_POST['checksum'], $SEC_KEY);
        if (is_array($result)) {
            $r = $result;
        }
        else {
            $data = $result;
            $USER['als'] = true;
        }

        $ALS = true;
    }
    else {
        $data = stripslashes($data);

        if ($fun !== 'get_captcha'
        &&  $fun !== 'get_token'
        &&  $fun !== null) {
            $arr  = json_decode($data, true, 8);
            if ( !is_array($arr) ) {
                $r = make_failure(ERROR_INVALID_ARGUMENTS, 'Invalid `data`.');
            }
        }
    }

    if (strlen($data) > MAX_DATA_SIZE) $r = make_failure(ERROR_MISUSE, '`data` size exceeds '.MAX_DATA_SIZE.' byte limit.');

    if ($r === null) {
        $ARGS     = extract_args($data);
        $GUID     = $ARGS['guid'];

        if ($GUID) {
            if ( ($session_nr = get_session_nr($l, $GUID)) === null && $fun != 'init') {
                $r = make_failure(ERROR_INVALID_ARGUMENTS, 'Session `'.$GUID.'` does not exist.');
            }
            else {
                $USER['session'] = $session_nr;
                $old_ip = get_session_variable($l, $GUID, 'ip');

                increase_session_stat($l, $GUID, 'requests');
                update_session_stat  ($l, $GUID, 'ip', $IP);
                db_query($l, "UPDATE `session` SET `last_request` = NOW() WHERE `guid` = X'".$GUID."'");

                if ($ALS && $fun != 'init') {
                    $nonce = get_session_variable($l, $GUID, 'nonce');
                    $seed  = get_session_variable($l, $GUID, 'seed');

                    if ($nonce !== null) $nonce = bin2hex($nonce);
                    if ($ARGS['nonce'] !== $nonce) {
                        $alias = get_session_variable($l, $GUID, 'alias');
                        $r = make_failure(ERROR_NONCE, 'Invalid `nonce` from `'.$IP.'`'.($alias !== null ? ' ('.$alias.')' : '').'.'
                           . ($old_ip !== $IP ? (' Last valid nonce from `'.($old_ip != null ? $old_ip : 'null').'`.') : ''));
                    }
                    else if ($nonce !== null && $seed !== null){
                        $next_nonce = hash("sha256", pack("H*",$nonce).$seed, false);

                        $query = "UPDATE `session` SET `nonce` = X'".$next_nonce."' WHERE `guid` = X'".$GUID."'";
                        $q = db_query($l, $query);
                        if ($q['affected_rows'] === 0) {
                            $q = db_query($l, $query);

                            db_log($l, $USER, "The `nonce` of session #".$session_nr." failed to update, retrying...", LOG_ALERT);

                            if ($q['affected_rows'] === 0) {
                                $r = make_failure(ERROR_INTERNAL, 'Cannot update `nonce` for session #'.$session_nr.'.');
                            }
                            else db_log($l, $USER, "The `nonce` of session #".$session_nr." was successfully updated.", LOG_ALERT);
                        }
                        if ($q['errno'] !== 0) $r = make_failure(ERROR_SQL, $q['error']);
                    }
                    else {
                        $r = make_failure(ERROR_INTERNAL, 'Cannot update `nonce` for session #'.$session_nr.' because old nonce or `seed` is NULL.');
                    }
                }
            }
        }
    }

    $no_fun = false;
    if ($r === null) {
      switch ($fun) {
        case 'handshake'         : $r=fun_handshake        ($l, $USER, $IP, $_POST['sec_key'], $HTTPS);                                           break;
        case 'init'              : $r=fun_init             ($l, $USER, $IP, $GUID, $_POST['sec_hash'], $HTTPS, $ARGS['restore']);                 break;
        case 'get_session'       : $r=fun_get_session      ($l, $USER, $GUID);                                                                    break;
        case 'get_stats'         : $r=fun_get_stats        ($l, $USER, $GUID, $ARGS['start_date'],  $ARGS['end_date']);                           break;
        case 'get_log'           : $r=fun_get_log          ($l, $USER, $GUID, $ARGS['nr'],  $ARGS['count']);                                      break;
        case 'get_msg_metadata'  : $r=fun_get_msg_metadata ($l, $USER, $GUID, $ARGS['txids']);                                                    break;
        case 'get_btc_graffiti'  : $r=fun_get_btc_graffiti ($l, $USER, $GUID, $ARGS['nr'],  $ARGS['count'], $ARGS['back'], $ARGS['mimetype']);    break;
        case 'get_graffiti'      : $r=fun_get_graffiti     ($l, $USER, $GUID, $ARGS['nr'],  $ARGS['count'], $ARGS['back'], $ARGS['mimetype']);    break;
        case 'get_txs'           : $r=fun_get_txs          ($l, $USER, $GUID, $ARGS['nr'],  $ARGS['count'], $ARGS['back'], $ARGS['mimetype']);    break;
        case 'get_btc_donations' : $r=fun_get_btc_donations($l, $USER, $GUID, $ARGS['nr'],  $ARGS['count'], $ARGS['back'], $ARGS['mimetype']);    break;
        case 'set_btc_txs'       : $r=fun_set_btc_txs      ($l, $USER, $GUID, $ARGS['txs']);                                                      break;
        case 'set_txs'           : $r=fun_set_txs          ($l, $USER, $GUID, $ARGS['graffiti']);                                                 break;
        case 'accept_order'      : $r=fun_accept_order     ($l, $USER, $GUID, $ARGS['nr']);                                                       break;
        case 'set_order'         : $r=fun_set_order        ($l, $USER, $GUID, $ARGS['nr'], $ARGS['output'], $ARGS['filled']);                     break;
        case 'get_order'         : $r=fun_get_order        ($l, $USER, $GUID, $ARGS['nr'], $ARGS['inclusive']);                                   break;
        case 'get_constants'     : $r=fun_get_constants    ($l, $USER, $GUID);                                                                    break;
        case 'make_order'        : $r=fun_make_order       ($l, $USER, $GUID, $ARGS['group'], $ARGS['input'], $ARGS['token']);                    break;
        // TODO: Remove the fallback to `inclusive` variable when all bitbroker instances have been updated:
        case 'get_orders'        : $r=fun_get_orders       ($l, $USER, $GUID, $ARGS['group'], $ARGS['nr'],   $ARGS['count'],  $ARGS['back'],
                                                           ($ARGS['accepted']===null ? $ARGS['inclusive'] : $ARGS['accepted']), $ARGS['filled'],
                                                           $ARGS['executive']);                                                                   break;
        case 'send_mail'         : $r=fun_send_mail        ($l, $USER, $GUID, $ARGS['to'], $ARGS['subj'], $ARGS['msg'], $ARGS['headers']);        break;
        case 'set_stat'          : $r=fun_set_stat         ($l, $USER, $GUID, $ARGS['name'], $ARGS['value']);                                     break;
        default                  : $r=fun_default          ($l, $USER); $no_fun = true;                                                           break;
      }
    }

    if (is_array($r)) {
        if (array_key_exists('error', $r)) {
            $inc_errors = true;
            if (is_array($r['error'])) {
                $r['error']['fun']  = $fun;
                $r['error']['data'] = $data;
                if (array_key_exists('code', $r['error'])) {
                    $level = LOG_ERROR;
                    if ($r['error']['code'] == ERROR_INVALID_ARGUMENTS
                    ||  $r['error']['code'] == ERROR_MISUSE
                    ||  $r['error']['code'] == ERROR_NO_CHANGE
                    ||  $r['error']['code'] == ERROR_ACCESS_DENIED
                    ||  $r['error']['code'] == ERROR_NONCE) {
                        increase_stat($l, "invalid_requests");
                        $inc_errors = false;
                        $level = LOG_MISUSE;
                    }
                    if ($r['error']['code'] == ERROR_CRITICAL
                    ||  $r['error']['code'] == ERROR_INTERNAL
                    ||  $r['error']['code'] == ERROR_TABLE_ASSURANCE
                    ||  $r['error']['code'] == ERROR_DATABASE_CONNECTION
                    ||  $r['error']['code'] == ERROR_SQL) {
                        $level = LOG_CRITICAL;
                    }

                    if ($no_fun) {
                        if (count($_REQUEST) > 0) {
                            $request = var_export(json_encode($_REQUEST), true);
                            db_log($l, $USER, "Suspicious ".$_SERVER['REQUEST_METHOD']." request from ".$USER['ip'].":\n".$request, LOG_MINOR);
                        }
                    }
                    else if ($r['error']['code'] !== ERROR_NO_CHANGE
                         &&  $r['error']['code'] !== ERROR_BAD_TIMING) {
                        $log = "";
                        $request = var_export($data, true);
                        if (strlen($request) > 0) {
                            $log.= "Suspicious `data` parameter from ".$USER['ip'].":\n".$fun.": ".$request;
                        }

                        $params = array();
                        foreach ($_REQUEST as $key => $value) {
                            if ($key === 'fun' || $key === 'data') continue;
                            $params[$key] = $value;
                        }
                        if (count($params) > 0) {
                            if (strlen($log) > 0) $log .= "\n";
                            $log .= "Other ".$_SERVER['REQUEST_METHOD']." parameters: ";
                            $log .= var_export(json_encode($params), true);
                        }

                        db_log($l, $USER, $log, LOG_MINOR);
                    }

                    db_log($l, $USER, $r, $level);
                }
            }
            if ($inc_errors) increase_stat($l, "errors");
        }
        if ($api_usage !== null) $r['api_usage'] = $api_usage;

        if ($ALS && $SEC_KEY !== null) {
            if (strlen($_POST['salt']) === 32
            &&  ctype_xdigit($_POST['salt'])) {
                $key   = bin2hex($SEC_KEY);
                $iv    = md5(generateRandomString(16));
                $plain = json_encode($r);
                $edata = AES_256_encrypt($plain, $key, $iv);
                $cs    = md5($plain.$key);
                echo json_encode(array('iv' => $iv, 'data' => $edata, 'checksum' => $cs));
            }
        }
        else echo json_encode($r);
    }
    deinit_sql($l);
}
else {
    echo json_encode(array('result' => make_result(false),
                           'error'  => make_error(ERROR_DATABASE_CONNECTION, 'Database connection failed.')));
}

function assure_tables($l) {
    // Must be first, because other assurances might want to use it:
    if (!assure_log($l)         ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `log`.')     ;

    // Assume that `log` table is accessible:
    if (!assure_stats($l)       ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `stats`.')   ;
    if (!assure_session($l)     ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `session`.') ;
    if (!assure_security($l)    ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `security`.');
    if (!assure_address($l)     ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `address`.') ;
    if (!assure_captcha($l)     ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `captcha`.') ;
    if (!assure_graffiti($l)    ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `graffiti`.');
    if (!assure_tx($l)          ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `tx`.')      ;
    if (!assure_btc_tx($l)      ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `btc_tx`.')  ;
    if (!assure_order($l)       ) return make_failure(ERROR_TABLE_ASSURANCE, 'Unable to assure table `order`.')   ;

    return true;
}

?>
