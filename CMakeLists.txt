cmake_minimum_required(VERSION 3.20)
project(GUI_Video_Downloader)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Widgets Network REQUIRED)

if(WIN32)
    set(RES_FILE resources.rc)
endif()

add_executable(App
        ${RES_FILE}
        main.cpp
        Installer/installer_window.cpp
        Installer/installer_window.h
        Resources/popup.cpp
        Resources/popup.h
        App/settings_page.cpp
        App/settings_page.h
        App/console_page.cpp
        App/console_page.h
        App/main_page.cpp
        App/main_page.h
        App/config_manager.cpp
        App/config_manager.h
        App/dependency_manager.cpp
        App/dependency_manager.h
)

target_link_libraries(App Qt6::Widgets Qt6::Network)

add_custom_command(TARGET App POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_SOURCE_DIR}/Resources ${CMAKE_BINARY_DIR}/Resources)