/*
 * MIT License
 *
 * Copyright (c) 2021 Erich Erstu
 * Copyright (c) 2019 Matthew Little
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Originally extracted from https://github.com/crypto-browserify/ripemd160
 * Converted into a single function by Erich Erstu in 2021.
 *
 * Progressive hashing:
 * --------------------
 *     var hasher = rmd160();
 *     hasher = rmd160(new Uint8Array(str2utf8_array("x")), hasher);
 *     hasher = rmd160(new Uint8Array(str2utf8_array("x")), hasher);
 *     hasher = rmd160(new Uint8Array(str2utf8_array("x")), hasher);
 *     console.log(rmd160(null, hasher));
 *
 * Quick hashing:
 * --------------------
 *     console.log(rmd160(new Uint8Array(str2utf8_array("xxx")));
 *
 */

"use strict";
function rmd160(uint8_array, state) {
    uint8_array = typeof uint8_array !== 'undefined' ? uint8_array : null;
    state = typeof state !== 'undefined' ? state : null;

    var fun = {
        rotl : function(x, n) {
            return (x << n) | (x >>> (32 - n));
        },
        fn1 : function (a, b, c, d, e, m, k, s) {
            return (fun.rotl((a + (b ^ c ^ d) + m + k) | 0, s) + e) | 0;
        },
        fn2 : function (a, b, c, d, e, m, k, s) {
            return (
                fun.rotl((a + ((b & c) | ((~b) & d)) + m + k) | 0, s) + e
            ) | 0;
        },
        fn3 : function (a, b, c, d, e, m, k, s) {
            return (fun.rotl((a + ((b | (~c)) ^ d) + m + k) | 0, s) + e) | 0;
        },
        fn4 : function (a, b, c, d, e, m, k, s) {
            return (
                fun.rotl((a + ((b & d) | (c & (~d))) + m + k) | 0, s) + e
            ) | 0;
        },
        fn5 : function (a, b, c, d, e, m, k, s) {
            return (fun.rotl((a + (b ^ (c | (~d))) + m + k) | 0, s) + e) | 0;
        },
        readInt32LE : function (buffer, offset) {
            offset >>>= 0;
            return (buffer[offset])
                | (buffer[offset + 1] << 8)
                | (buffer[offset + 2] << 16)
                | (buffer[offset + 3] << 24);
        },
        writeUInt32LE : function (buffer, value, offset) {
            value = +value;
            offset >>>= 0;
            buffer[offset + 3] = (value >>> 24);
            buffer[offset + 2] = (value >>> 16);
            buffer[offset + 1] = (value >>> 8);
            buffer[offset] = (value & 0xff);
            return offset + 4;
        },
        writeInt32LE : function (buffer, value, offset) {
            value = +value;
            offset >>>= 0;
            buffer[offset] = (value & 0xff);
            buffer[offset + 1] = (value >>> 8);
            buffer[offset + 2] = (value >>> 16);
            buffer[offset + 3] = (value >>> 24);
            return offset + 4;
        },
        initU32Array : function (data) {
            if (typeof Uint32Array !== 'undefined') {
                return new Uint32Array(data);
            }
            else {
                return data;
            }
        },
        initU8Array : function (data) {
            if (typeof Uint8Array !== 'undefined') {
                return new Uint8Array(data);
            }
            else {
                return data;
            }
        },
        createU8Array : function (size) {
            if (typeof Uint8Array !== 'undefined') {
                return new Uint8Array(size);
            }
            else {
                return new Array(size);
            }
        },
        progress : function (state, data) {
            if (state.finalized) throw new Error('Digest already called');

            // consume data
            const block = state.block;
            let offset = 0;

            while (state.blockOffset+data.length - offset >= state.blockSize) {
                for (let i = state.blockOffset; i < state.blockSize;) {
                    block[i++] = data[offset++];
                }

                fun.update(state);
                state.blockOffset = 0;
            }

            while (offset < data.length) {
                block[state.blockOffset++] = data[offset++];
            }

            // update length
            for (let j = 0, carry = data.length * 8; carry > 0; ++j) {
                state.len[j] += carry;
                carry = (state.len[j] / 0x0100000000) | 0;

                if (carry > 0) {
                    state.len[j] -= 0x0100000000 * carry;
                }
            }

            return state;
        },
        update : function (state) {
            const words = ARRAY16;

            for (let j = 0; j < 16; ++j) {
                words[j] = fun.readInt32LE(state.block, j * 4);
            }

            let al = state.a | 0;
            let bl = state.b | 0;
            let cl = state.c | 0;
            let dl = state.d | 0;
            let el = state.e | 0;
            let ar = state.a | 0;
            let br = state.b | 0;
            let cr = state.c | 0;
            let dr = state.d | 0;
            let er = state.e | 0;

            // computation
            for (let i = 0; i < 80; i += 1) {
                let tl;
                let tr;

                if (i < 16) {
                    tl = fun.fn1(
                        al, bl, cl, dl, el, words[zl[i]], hl[0], sl[i]
                    );

                    tr = fun.fn5(
                        ar, br, cr, dr, er, words[zr[i]], hr[0], sr[i]
                    );
                }
                else if (i < 32) {
                    tl = fun.fn2(
                        al, bl, cl, dl, el, words[zl[i]], hl[1], sl[i]
                    );

                    tr = fun.fn4(
                        ar, br, cr, dr, er, words[zr[i]], hr[1], sr[i]
                    );
                }
                else if (i < 48) {
                    tl = fun.fn3(
                        al, bl, cl, dl, el, words[zl[i]], hl[2], sl[i]
                    );

                    tr = fun.fn3(
                        ar, br, cr, dr, er, words[zr[i]], hr[2], sr[i]
                    );
                }
                else if (i < 64) {
                    tl = fun.fn4(
                        al, bl, cl, dl, el, words[zl[i]], hl[3], sl[i]
                    );

                    tr = fun.fn2(
                        ar, br, cr, dr, er, words[zr[i]], hr[3], sr[i]
                    );
                }
                else {
                    tl = fun.fn5(
                        al, bl, cl, dl, el, words[zl[i]], hl[4], sl[i]
                    );

                    tr = fun.fn1(
                        ar, br, cr, dr, er, words[zr[i]], hr[4], sr[i]
                    );
                }

                al = el;
                el = dl;
                dl = fun.rotl(cl, 10);
                cl = bl;
                bl = tl;
                ar = er;
                er = dr;
                dr = fun.rotl(cr, 10);
                cr = br;
                br = tr;
            }

            // update state
            const t = (state.b + cl + dr) | 0;
            state.b = (state.c + dl + er) | 0;
            state.c = (state.d + el + ar) | 0;
            state.d = (state.e + al + br) | 0;
            state.e = (state.a + bl + cr) | 0;
            state.a = t;
        },
        digest : function (state) {
            if (state.finalized) {
                throw new Error('Digest already called');
            }

            state.finalized = true;

            // create padding and handle blocks
            state.block[state.blockOffset++] = 0x80;

            if (state.blockOffset > 56) {
                state.block.fill(0, state.blockOffset, 64);
                fun.update(state);
                state.blockOffset = 0;
            }

            state.block.fill(0, state.blockOffset, 56);
            fun.writeUInt32LE(state.block, state.len[0], 56);
            fun.writeUInt32LE(state.block, state.len[1], 60);
            fun.update(state);

            // produce result
            const buffer = fun.createU8Array(20);
            fun.writeInt32LE(buffer, state.a, 0);
            fun.writeInt32LE(buffer, state.b, 4);
            fun.writeInt32LE(buffer, state.c, 8);
            fun.writeInt32LE(buffer, state.d, 12);
            fun.writeInt32LE(buffer, state.e, 16);

            // reset state
            state.block.fill(0);
            state.blockOffset = 0;

            for (let i = 0; i < 4; ++i) {
                state.len[i] = 0;
            }

            return buffer;
        }
    };

    const ARRAY16 = new Array(16);
    const zl = fun.initU8Array(
        [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
            7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
            3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
            1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
            4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
        ]
    );
    const zr = fun.initU8Array(
        [
            5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
            6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
            15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
            8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
            12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
        ]
    );
    const sl = fun.initU8Array(
        [
            11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
            7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
            11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
            11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
            9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
        ]
    );
    const sr = fun.initU8Array(
        [
            8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
            9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
            9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
            15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
            8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
        ]
    );
    const hl = fun.initU32Array(
        [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e]
    );
    const hr = fun.initU32Array(
        [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000]
    );

    if (state === null) {
        state = {
            block : fun.createU8Array(64),
            blockSize : 64,
            blockOffset : 0,
            len : [0, 0, 0, 0],
            finalized : false,
            a : 0x67452301,
            b : 0xefcdab89,
            c : 0x98badcfe,
            d : 0x10325476,
            e : 0xc3d2e1f0
        };

        if (uint8_array === null) return state;

        fun.progress(state, uint8_array);
        return fun.digest(state);
    }

    if (uint8_array === null) {
        return fun.digest(state);
    }

    fun.progress(state, uint8_array);

    return state;
}
