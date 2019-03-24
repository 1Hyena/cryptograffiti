#include "decoder.h"
#include "utils.h"
#include "json.h"

bool DECODER::decode(const std::string &data, nlohmann::json *result) {
    nlohmann::json buf = nlohmann::json();
    nlohmann::json tx  = nlohmann::json();

    if (result == nullptr) result = &buf;

    std::exception_ptr eptr;
    try         {tx   = nlohmann::json::parse(data);    }
    catch (...) {eptr = std::current_exception();       }
    try         {if (eptr) std::rethrow_exception(eptr);}
    catch (const std::exception& e) {
        (*result)["error"] = e.what();
        return false;
    }

    if (!tx.count("txid") || !tx["txid"].is_string()) {
        (*result)["error"] = "invalid txid structure";
        return false;
    }

    (*result)["txid"] = tx["txid"].get<std::string>();

    if (!tx.count("vout") || !tx["vout"].is_array()) {
        (*result)["error"] = "invalid vout structure";
        return false;
    }

    std::queue<graffiti_type> graffiti;

    for (auto &vout : tx["vout"]) {
        if (!vout.count("scriptPubKey")
        ||  !vout.at("scriptPubKey").is_object()) {
            (*result)["error"] = "invalid scriptPubKey structure";
            return false;
        }

        auto &spk = vout["scriptPubKey"];

        if (!spk.count("hex") || !spk.at("hex").is_string()) {
            (*result)["error"] = "invalid hex structure";
            return false;
        }

        const std::string &hex = spk["hex"];
        if (!decode(hex, graffiti)) {
            (*result)["error"] = "failed to decode scriptPubKey['hex']";
            return false;
        }
    }

    std::vector<unsigned char> msg_bytes;
    (*result)["confirmations"] = 0;
    (*result)["graffiti"] = false;

    if (tx.count("confirmations") && tx["confirmations"].is_number()) {
        (*result)["confirmations"] = tx["confirmations"];
    }

    if (!graffiti.empty()) {
        (*result)["chunks"] = nlohmann::json::array();

        while (!graffiti.empty()) {
            size_t old_sz = graffiti.front().payload.size();
            trim_utf8(graffiti.front().payload);
            size_t new_sz = graffiti.front().payload.size();

            nlohmann::json chunk = nlohmann::json();

            switch (graffiti.front().where) {
                case LOCATION::OP_RETURN: chunk["type"] = std::string("OP_RETURN"); break;
                case LOCATION::P2PKH:     chunk["type"] = std::string("P2PKH");     break;
                default:                  chunk["type"] = std::string("UNKNOWN");   break;
            }

            chunk["initial_size"] = old_sz;
            chunk["trimmed_size"] = new_sz;

            std::vector<unsigned char> &payload = graffiti.front().payload;

            if (old_sz/10 + new_sz >= old_sz) {
                payload.push_back(0);
                chunk["unicode_body"] = std::string((const char *) &payload[0]);
                payload.pop_back();

                if (new_sz >= 4) {
                    msg_bytes.insert(msg_bytes.end(), payload.begin(), payload.end());
                }
                else chunk["error"] = std::string("too short");
            }
            else chunk["error"] = std::string("not plaintext");

            graffiti.pop();
            (*result)["chunks"].push_back(chunk);
        }

        std::vector<unsigned char> msg_hash = sha256(&msg_bytes[0], msg_bytes.size());
        (*result)["trimmed_size"] = msg_bytes.size();
        (*result)["trimmed_hash"] = std::string((const char *) (&msg_hash[0]));
    }

    if (!msg_bytes.empty()) (*result)["graffiti"] = true;

    return true;
}

bool DECODER::decode(const std::string &hex, std::queue<graffiti_type> &to) {
    LOCATION loc = LOCATION::NONE;
    size_t start_at = 0;

    if (!hex.compare(0, 2, "6a")) {
        // OP_RETURN detected
        loc = LOCATION::OP_RETURN;
        start_at = 2;
    }

    if (loc == LOCATION::NONE) {
        return true;
    }

    std::vector<unsigned char> bin;
    if (!hex2bin(hex.c_str()+start_at, &bin)) {
        return false;
    }

    if (loc == LOCATION::OP_RETURN) {
        std::map<size_t, size_t> segments;
        if (!get_opret_segments(bin, segments)) return false;

        for (auto &segment : segments) {
            size_t pos = segment.first;
            size_t len = segment.second;

            if (bin.size() > pos) {
                to.push( { loc, std::vector<unsigned char>(bin.begin()+pos, bin.begin()+pos+len) } );
            }
            else return false;
        }
    }

    return true;
}

bool DECODER::get_opret_segments(std::vector<unsigned char> &bytes, std::map<size_t, size_t> &to) {
    size_t sz = bytes.size();
    size_t start_pos = 0;

    std::vector<unsigned char> segment_size_bytes;
    std::map<size_t, size_t> opret_segments;

    Again:

    for (size_t i=start_pos; i<sz; ++i) {
        unsigned char byte = bytes[i];

        if (!segment_size_bytes.empty()) {
            size_t size_bytes = segment_size_bytes[0];

            if (segment_size_bytes.size() < size_bytes + 1) {
                segment_size_bytes.push_back(byte);

                if (segment_size_bytes.size() == size_bytes + 1) {
                    size_t segment_size = 0;
                    while (segment_size_bytes.size() > 1) {
                        unsigned char sz_byte = segment_size_bytes.back();
                        segment_size_bytes.pop_back();
                        segment_size = (segment_size << 8) + sz_byte;
                    }

                    if (i + 1 + segment_size > sz) {
                        to.insert( { 0, sz } ); // Does not follow pushdata protocol.
                        return true;
                    }

                    if (segment_size) {
                        // We ignore zero size segments.
                        opret_segments.insert( { i+1, segment_size } );
                    }

                    start_pos = i + 1 + segment_size;
                    segment_size_bytes.clear();
                    goto Again;
                }

                continue;
            }

            return false; // Should never happen.
        }

        if (byte <= 75) {
            segment_size_bytes.push_back(1);
            goto Again;
        }
        else if (byte == 76) {
            segment_size_bytes.push_back(1);
        }
        else if (byte == 77) {
            segment_size_bytes.push_back(2);
        }
        else if (byte == 78) {
            segment_size_bytes.push_back(4);
        }
        else {
            to.insert( { 0, sz } ); // Does not follow pushdata protocol.
            return true;
        }
    }

    if (!segment_size_bytes.empty()) {
        to.insert( { 0, sz } ); // Does not follow pushdata protocol.
        return true;
    }

    to.insert(opret_segments.begin(), opret_segments.end());
    return true;
}

