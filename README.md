# CryptoGraffiti Client v1.10 (discontinued)
A browser-based client for the CryptoGraffiti service which allows the encoding
and decoding of human-readable messages respectively to and from the Bitcoin's
block chain.

This service operates solely on the block chain of the Original Bitcoin which is
also known as Bitcoin Satoshi Vision (BSV). For that reason, all references to
Bitcoin are equivalent to [Bitcoin SV](https://bitcoinsv.io "Homepage of BSV").

HASHTAG API
===========
CryptoGraffiti.info can be customly configured with the help of a hashtag. For
example, you can programmatically fill the text to be saved on the block chain
so that when the user loads CryptoGraffiti.info in their browser they are
automatically sent to the payment form. What is more, you can embed your own
Bitcoin receiving address in the message so that a part of the payment is sent
to you. Below is a list of examples for the hashtag API.

* `https://cryptograffiti.info/#write:M#CT#1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS:1`

  The above link would redirect the user to a payment form for saving a message
  `M` under the category `CT` on the Bitcoin's block chain. Also, 1 bitcoin will
  be sent to `1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS`. The category specifier is
  optional and can be omitted.
* `https://cryptograffiti.info/#wedding`

  The above link will open the CryptoGraffiti's interface in a way that only
  messages under the `wedding` category will be decoded and displayed in the
  read tab. Category can be any word or even a Bitcoin address. In case of an
  address only the messages including it will be shown to the user. For example,
  https://cryptograffiti.info/#1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS decodes only
  such block chain messages that contain a payment to CryptoGraffiti.info.

* `https://cryptograffiti.info/#mimetype:image`

  The `mimetype` hashtag parameter will make sure that only those graffiti are
  displayed under the read tab which are known to contain a block chain file of
  the specified type. In the example case, only image files will be decoded.
  This parameter can be combined with other parameters but it only affects the
  contents displayed under the read tab.
