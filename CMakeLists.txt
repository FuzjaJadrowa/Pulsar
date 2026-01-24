cmake_minimum_required(VERSION 3.20)
project(GUI_Video_Downloader)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Widgets Network REQUIRED)

add_executable(App
        main.cpp
        Installer/installer_window.cpp
        Installer/installer_window.h
        resources.rc
)

target_link_libraries(App Qt6::Widgets Qt6::Network)