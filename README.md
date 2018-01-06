# CryptoGraffiti Client
A browser-based client for the CryptoGraffiti service which allows the encoding
and decoding of human-readable messages respectively to and from the Bitcoin's
block chain.

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
  be sent to `1MVpQJA7FtcDrwKC6zATkZvZcxqma4JixS`.
* `https://cryptograffiti.info/#wedding`

  The above link will open the CryptoGraffiti's interface in a way that only
  messages under the `wedding` category will be decoded and displayed in the
  read tab. Category can be any word or even a Bitcoin address. In case of an
  address only the messages including it will be shown to the user. For example,
  https://cryptograffiti.info/#1Ross5Np5doy4ajF9iGXzgKaC2Q3Pwwxv decodes only
  such block chain messages that contain a donation to Ross Ulbricht.
