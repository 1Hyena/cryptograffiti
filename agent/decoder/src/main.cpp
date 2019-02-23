#include <cstdlib>
#include <iostream>

#include "json.h"

const char *PROGRAM_NAME = nullptr;

bool dump_json(const nlohmann::json &json, const int indent, std::string *to) {
    std::string result;
    try {
        result = json.dump(indent);
    }
    catch (nlohmann::json::type_error& e) {
        std::cerr << PROGRAM_NAME << ": " << e.what() << std::endl;
        return false;
    }

    to->swap(result);
    return true;
}

int main(int argc, char **argv) {
    PROGRAM_NAME = argv[0];
    std::string data(std::istreambuf_iterator<char>(std::cin), {});
    nlohmann::json json = nlohmann::json();

    std::exception_ptr eptr;
    try         {json = nlohmann::json::parse(data);    }
    catch (...) {eptr = std::current_exception();       }
    try         {if (eptr) std::rethrow_exception(eptr);}
    catch (const std::exception& e) {
        std::cerr << PROGRAM_NAME << ": " << e.what() << std::endl;
        return EXIT_FAILURE;
    }

    if (!dump_json(json, 4, &data)) return EXIT_FAILURE;

    //std::cout << data << std::endl;

    std::cout << json["txid"].get<std::string>() << std::endl;

    return EXIT_SUCCESS;
}

