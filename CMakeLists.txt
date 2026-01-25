cmake_minimum_required(VERSION 3.20)
project(GUI_Video_Downloader)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Widgets Network REQUIRED)

set(PROJECT_SOURCES
        main.cpp
        Installer/installer_window.cpp
        Installer/installer_window.h
        App/popup.cpp
        App/popup.h
        App/settings_page.cpp
        App/settings_page.h
        App/console_page.cpp
        App/console_page.h
        App/main_page.cpp
        App/main_page.h
        App/config_manager.cpp
        App/config_manager.h
        resources.rc
        resources.qrc
)

if(WIN32)
    list(APPEND PROJECT_SOURCES resources.rc)
endif()

add_executable(App ${PROJECT_SOURCES})

if(APPLE)
    set_target_properties(App PROPERTIES
            MACOSX_BUNDLE TRUE
            MACOSX_BUNDLE_BUNDLE_NAME "GUI Video Downloader"
            MACOSX_BUNDLE_GUI_IDENTIFIER "com.fuzjajadrowa.downloader"
            MACOSX_BUNDLE_ICON_FILE "icon.icns"
    )
    set_source_files_properties(Resources/Icons/icon.icns PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
endif()

target_link_libraries(App PRIVATE Qt6::Widgets Qt6::Network)

if(NOT APPLE)
    add_custom_command(TARGET App POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_directory
            ${CMAKE_SOURCE_DIR}/Resources ${CMAKE_BINARY_DIR}/Resources)
endif()