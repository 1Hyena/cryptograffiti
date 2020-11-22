PUBLIC API, 22. 11. 2020
--------------------------------------------------------------------------------

##### TERMS OF USE #############################################################
It is not allowed to make more than 60 API requests per minute. Exceeding this
limit will have your IP temporarily banned. By supplying a secret token it is
possible to bypass the ban. Getting this token requires solving a challenge.
There are API functions for that:
* `get_captcha` _gets a new challenge._
* `get_token` _solves the challange to receive a Proof of Work (PoW)._


##### DATA FORMAT ##############################################################
Numbers in `data` dictionary must be sent in a string format (surrounded by
quote marks). The `data` dictionary cannot be deeper than 8 levels of recursion.


##### ERRORS ###################################################################
In case of global failures, the API returns a JSON dictionary containing the
error info as described below.
* `result` _FAILURE_
* `error` _JSON dictionary containing the error data (see `code` list below)_
   * `ERROR_CRITICAL`            - should never happen, only for critial errors
   * `ERROR_INTERNAL`            - should never happen, server is malfunctional
   * `ERROR_TABLE_ASSURANCE`     - should never happen, server is malfunctional
   * `ERROR_DATABASE_CONNECTION` - should never happen, server is malfunctional
   * `ERROR_SQL`                 - should never happen, server is malfunctional
   * `ERROR_NO_CHANGE`           - can rarely happen but NOT REPEATEDLY
   * `ERROR_INVALID_ARGUMENTS`   - invalid request, client is malfunctional
   * `ERROR_MISUSE`              - invalid request, client is malfunctional
   * `ERROR_NONCE`               - unexpected nonce, possible MITM attack
   * `ERROR_ACCESS_DENIED`       - access denied, client has banned IP address


##### CONSTANTS ################################################################
These values can be received with an API call of `get_constants` function.
* `STATS_PER_QUERY`      - max number of `stats` rows returned from `get_stats`
* `LOGS_PER_QUERY`       - max number of `log` rows returned from `get_log`
* `ORDERS_PER_QUERY`     - max number of `order` rows from `get_*_orders` calls
* `SESSION_TIMEOUT`      - number of seconds for the session to timeout
* `CAPTCHA_TIMEOUT`      - number of seconds unused captchas are kept in the DB
* `MAX_DATA_SIZE`        - max number of uncompressed and unencrypted data bytes
* `TXS_PER_QUERY`        - max number of TXs to be dealt with for each API call
* `ROWS_PER_QUERY`       - max number of rows to be dealt with for each API call


##### APPLICATION LAYER SECURITY ###############################################
*   CONFIDENTIALITY
    In case of ALS (Application Layer Security) the server takes `data` argument
    as Base64 encoded representation of AES-256 encrypted JSON dictionary.
    Server needs `sec_key` to cypher or decypher `data`. When doing AES-256-CFB
    on `data`, `sec_key` is used by its 32-byte binary string value and
    initialization vector is the 16-byte binary representation of `salt`. The
    encrypted data sent as a response is wrapped into a JSON dictionary having
    `iv` indicating the initialization vector and `data` AES-256-CFB encrypted
    JSON dictionary.

    Client sends `sec_key` only once during Security Handshake and then stores
    the key for later use. It is important for the client to maintain that key
    in its own local storage (similarly to SSL certificates). With each HTTP
    POST request, client also sends `sec_hash` and `salt`. Server uses
    `sec_hash` to find a proper `sec_key`. `sec_hash` is SHA256 taken from the
    binary representation of `sec_key`. `salt` is a 32-byte hex string that
    should be different for every request.

    When ALS is enabled, all `data` dictionaries that contain `guid` will also
    have to contain `nonce` (except Initialize). Client receives `nonce` and
    `seed` as a response to Initialization. BEFORE each subsequent API call the
    client has to renew the `nonce` so that new nonce will be equal to
    SHA256(`nonce` + `seed`) where `nonce` and `seed` are concatenated to
    64-byte binary string. It is a common mistake here to calculate the SHA 256
    hash of a hex string instead of its underlying binary data.

*   INTEGRITY
    When ALS is enabled all POST requests that use it must include a `checksum`
    parameter that is calculated by taking MD5 from the concatenation of
    unencrypted `data` and `sec_key` where the latter is used by its hex string
    value (64 bytes). All responses from the server will also have a checksum
    added in the same manner: `checksum` = MD5(`data`..bin2hex(`sec_key`)).


##### PUBLIC FUNCTIONS #########################################################
* __Security Handshake__
    `POST https://cryptograffiti.info/api/`

    Used when the user is visiting the site for the first time. This is the 1st
    and only time when the session is prone to Man In The Middle attacks. The
    user generates a strong key and sends it to the server. The server remembers
    the key and starts using it for encryption. The key is always sent as a
    64-byte hex string. If the result was `FAILURE` the client is ought to
    generate a new key and try again. On `SUCCESS` the client should store the
    key and use it for all its further requests.

    __Please note that the security handshake is only a prerequisite for calling
    protected and private functions. Private functions are used internally by
    CryptoGraffiti.info services so unless you are part of our development team
    you most likely do not need to conduct a security handshake.__

    _POST Parameters:_
    * `fun`            --- `handshake`
    * `data`           --- JSON string with the structure of an empty object
    * `sec_key`        --- 64 bytes hex string
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary_:
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `TLS`        --- `true` if request was HTTPS (mandatory on `SUCCESS`)
        * `error`      --- error dictionary if result was `FAILURE` (optional)


* __Initialize__
    `POST https://cryptograffiti.info/api/`

    Used to register a whole new session identifier. The GUID should be a random
    256 bit number and is sent to the server as 64 byte hex string. Any old
    session can be restored when the client knows its GUID (except that when ALS
    was enabled during session creation the client can only restore the old
    session when it knows its `guid`, `seed` and last `nonce`). The client
    should not share its GUID with anyone. In case the GUID has already been
    registered the server returns an error and PREVIOUSLY used `nonce` so that
    the session could be restored when the client knows `seed`. If the session
    does not have a `seed` yet but ALS was used then `seed` is created and
    returned. This function should be called to generate a whole new session or
    to restore a session when `nonce` has been lost. If the client wishes to
    restore the existing session it is advised to provide the `restore`
    parameter as '1' so that the server would not return an error.

    __Please note that session initialization is only a prerequisite for calling
    protected and private functions. Private functions are used internally by
    CryptoGraffiti.info services so unless you are part of our development team
    you most likely do not need to initialize a session.__

    _POST Parameters_
    * `fun`            --- `init`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string
        * `restore`    --- when '1' attempt to restore an old session (optional)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if `result` was `FAILURE` (optional)
        * `TLS`        --- `true` if request was HTTPS (mandatory on `SUCCESS`)
        * `ALS`        --- `true` if ALS is being used (mandatory on `SUCCESS`)
        * `nonce`      --- replay protection, forces synchronized requests (ALS)
        * `seed`       --- used for finding the next `nonce` (ALS)
                           `next_nonce` = SHA256(`nonce`+`seed`)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Get Statistics__
    `POST https://cryptograffiti.info/api/`

    Returns the statistics for the asked timespan. Maximum of `STATS_PER_QUERY`
    entries will be returned as a result of a single call to this function. When
    `start_date` and `end_date` are both omitted or `null` the current state of
    statistics is returned.

    _POST Parameters:_
    * `fun`            --- `get_stats`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string (optional)
        * `start_date` --- YYYY-MM-DD
        * `end_date`   --- YYYY-MM-DD
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `stats`      --- server statistics for each day (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Get Graffiti__
    `POST https://cryptograffiti.info/api/`

    Returns the graffiti in the defined range. If `nr` is not sent or is invalid
    then newest `count` of graffiti instances is returned. If `mimetype` is
    specified then only the graffiti matching with the selected mime-type are
    returned. The `count` parameter cannot exceed `ROWS_PER_QUERY`.

    _POST Parameters:_
    * `fun`            --- `get_graffiti`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string (optional)
        * `nr`         --- the number of the first graffiti entry (optional)
        * `count`      --- the total number of graffiti entries to be returned
        * `back`       --- if '1' get `count` earlier than `nr` rows (optional)
        * `mimetype`   --- expected file type, may be partial (optional)
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `rows`       --- array of graffiti instances (optional)
    * `iv`             --- 32-byte hex string (ALS),
    * `checksum`       --- 32-byte hex string (ALS)


* __Get Transactions__
    `POST https://cryptograffiti.info/api/`

    $(
        curl -X POST                          \
        --data-urlencode 'fun=get_txs'        \
        --data-urlencode 'data={"count":"1"}' \
        https://cryptograffiti.info/api/
    )

    Returns Bitcoin transactions in the defined range. If `nr` is not sent or is
    invalid then newest `count` of transactions is returned. If `mimetype` is
    specified then only the transactions containing the graffiti that matches
    with the selected mime-type are returned. The `count` parameter cannot
    exceed `TXS_PER_QUERY`. If the `cache` parameter is set to '1', then fetch
    only those TX records that have their raw transaction details available on
    the server. If `cache` parameter is set to '0', then fetch only those TX
    records that have their raw transaction details missing from the server.
    If the `height` parameter is set, then only those TXs will be returned
    that have their block height equal to or greater than the value of the said
    parameter.

    _POST Parameters:_
    * `fun`            --- `get_txs`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string (optional)
        * `nr`         --- the number of the first TX record (optional)
        * `nrs`        --- array of transaction numbers (optional)
        * `count`      --- the total number of TX records to be returned
        * `back`       --- if '1' get `count` earlier than `nr` rows (optional)
        * `mimetype`   --- expected file type, may be partial (optional)
        * `cache`      --- presence of the raw transaction in cache (optional)
        * `height`     --- minimum block height of the TXs (optional)
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `txs`        --- array of transactions (optional)
    * `iv`             --- 32-byte hex string (ALS),
    * `checksum`       --- 32-byte hex string (ALS)


* __Get Constants__
    `POST https://cryptograffiti.info/api/`

    Returns the constants used by the server.

    _POST Parameters:_
    * `fun`            --- `get_constants`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string (optional)
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `constants`  --- server constants (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Get CAPTCHA__
    `POST https://cryptograffiti.info/api/`

    Returns the CAPTCHA to be solved. Additionally it may return a `token`
    variable in a 64-byte hex string format that can be used as Proof of Work in
    other functions. Token is not given if it is excessively used (abused) by
    the clients.

    _POST Parameters:_
    * `fun`            --- `get_captcha`

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `captcha`    --- JSON dictionary containing the CAPTCHA (optional)


* __Get Token__
    `POST https://cryptograffiti.info/api/`

    Returns the token as a reward for solving a CAPTCHA. Please note that
    providing a wrong answer to a CAPTCHA will invalidate the CAPTCHA. Calling
    this function more than once will also invalidate the token.

    _POST Parameters:_
    * `fun`            --- `get_token`
    * `img`            --- CAPTCHA such as "201309127663076785393-64-256.jpgx"
    * `code`           --- answer to the CAPTCHA such as "ABC"

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `token`      --- 64 bytes hex string to be used as PoW (optional)


* __Make Order__
    `POST https://cryptograffiti.info/api/`

    Add a new order for an executive bitbroker to fill.

    _POST Parameters:_
    * `fun`            --- `make_order`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string (optional)
        * `group`      --- number of the order group
        * `input`      --- JSON object
        * `token`      --- 64 bytes hex string as Proof of Work
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `nr`         --- number of the newly added order (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Get Orders__
    `POST https://cryptograffiti.info/api/`

    Get a list of orders. No more than `ORDERS_PER_QUERY` rows can be returned
    as a result of a single call to this function. If `nr` is not sent or is
    invalid then a list of newest orders is returned. If `accepted` is not sent
    or is invalid the result will include both accepted and not accepted orders.
    If `accepted` is '1' only accepted orders will be returned. If `accepted` is
    '0' only the orders that have not yet been accepted will be returned.
    If `filled` is not sent or is invalid the result will include both filled
    and not filled orders. If `filled` is '1' only filled orders will be
    returned. If `filled` is '0' only the orders that have not yet been filled
    will be returned. If `executive` is provided the function returns only the
    orders owned by the defined executive.

    _POST Parameters:_
    * `fun`            --- `get_orders`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string (optional)
        * `group`      --- number of the order group
        * `nr`         --- number of the first order to be returned (optional)
        * `count`      --- the total number of orders to be returned
        * `back`       --- if '1' get `count` earlier than `nr` rows (optional)
        * `accepted`   --- which group of orders to get? (optional)
                           '1' gets accepted
                           '0' gets not accepted
                           `null` gets all
        * `filled`     --- which group of orders to get? (optional)
                           '1' gets filled
                           '0' gets not filled
                           `null` gets all
        * `executive`  --- get only orders of a particular executive (optional)
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `orders`     --- array of orders (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Get Order__
    `POST https://cryptograffiti.info/api/`

    Get a single order. By default the `input` field of the order is not
    returned to save bandwidth. However, when `inclusive` is set to '1' original
    `input` will be included in the response as a JSON object. Due to privacy
    concerns, `inclusive` only works if the caller has an executive role.

    _POST Parameters:_
    * `fun`            --- `get_order`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string (optional)
        * `nr`         --- order number
        * `inclusive`  --- when '1', original input is also returned (optional)
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `order`      --- order data dictionary (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


##### PROTECTED FUNCTIONS ######################################################
* __Get Session Variables__
    `POST https://cryptograffiti.info/api/`

    Returns the list of variables associated to the current session.

    _POST Parameters:_
    * `fun`            --- `get_session`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes hex string
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `session`    --- JSON dictionary containing session data (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


##### PRIVATE FUNCTIONS ########################################################
* __Get Log__
    `POST https://cryptograffiti.info/api/`

    Returns the server log lines in the defined range. If `nr` is not sent or is
    invalid then last `count` of log lines are returned. `count` cannot exceed
    `LOGS_PER_QUERY`.

    _POST Parameters:_
    * `fun`            --- `get_log`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string
        * `nr`         --- number of the earliest row to be returned (optional)
        * `count`      --- the total number of log entries to be returned
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
        * `log`        --- JSON dictionary of the requested entries (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Set Transactions__
    `POST https://cryptograffiti.info/api/`

    Add a list of Bitcoin transactions. No more than `TXS_PER_QUERY` TXs can be
    sent with this function. If that limit is exceeded the function returns
    `FAILURE` without changing anything. Remember, that all dictionary values
    must be in string format.

    _POST Parameters:_
    * `fun`            --- `set_txs`
    * `data`           --- JSON string with the following structure
      * `guid`         --- 64 bytes random hex string,
      * `graffiti`     --- array of key-value pairs where TX hash is the key
        * `txsize`     --- total size of the transaction
        * `txtime`     --- TX block time in seconds since epoch (optional)
        * `txheight`   --- TX block height (optional)
        * `files`      --- array of graffiti objects
          * `location` --- location of the file within the TX
          * `fsize`    --- file size
          * `offset`   --- offset of the first byte
          * `type`     --- MIME type of the file
          * `hash`     --- RIPEMD-160 hash of the file
      * `nonce`        --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Accept Order__
    `POST https://cryptograffiti.info/api/`

    Accepts a new order. Only orders that have not yet been accepted can be
    accepted. The latter is to prevent multiple executives from processing the
    same order. If and only if the defined order has been accepted as a result
    of this request `SUCCESS` is returned as a result.

    _POST Parameters:_
    * `fun`            --- `accept_order`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string
        * `nr`         --- order number,
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Set Order__
    `POST https://cryptograffiti.info/api/`

    Set the output and status of an accepted order. This can only be done if the
    order is accepted and not filled. The executive session must be the same
    that of the caller of this function. If `filled` is invalid or not sent then
    it defaults to '0'.

    _POST Parameters:_
    * `fun`            --- `set_order`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string
        * `nr`         --- order number
        * `output`     --- JSON object
        * `filled`     --- '1' or '0'
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Send E-Mail__
    `POST https://cryptograffiti.info/api/`

    Sends an e-mail to the defined list of recipients.

    _POST Parameters:_
    * `fun`            --- `send_mail`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string
        * `to`         --- comma separated recipients
        * `subj`       --- subject of the e-mail
        * `msg`        --- message body
        * `headers`    --- string to be inserted at the end of the email header
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)


* __Set Stat__
    `POST https://cryptograffiti.info/api/`

    Set a new value to a global stat such as `sat_byte`.

    _POST Parameters:_
    * `fun`            --- `set_order`
    * `data`           --- JSON string with the following structure
        * `guid`       --- 64 bytes random hex string
        * `name`       --- name of the stat to modify
        * `value`      --- string value to assign to the stat
        * `nonce`      --- 64 bytes hex string (ALS)
    * `sec_hash`       --- SHA256(`sec_key`) as a 64-byte hex string (ALS)
    * `salt`           --- 32-byte hex string, must differ on each request (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
    * `token`          --- 64 bytes hex string (optional)

    _Returns a JSON dictionary:_
    * `data`
        * `result`     --- `SUCCESS` or `FAILURE`
        * `error`      --- error dictionary if result was `FAILURE` (optional)
    * `iv`             --- 32-byte hex string (ALS)
    * `checksum`       --- 32-byte hex string (ALS)
