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
        App/main_page.cpp
        App/main_page.h
        App/config_manager.cpp
        App/config_manager.h
        resources.qrc
        App/downloader.cpp
        App/downloader.h
        Installer/app_updater.cpp
        Installer/app_updater.h
)

if(WIN32)
    list(APPEND PROJECT_SOURCES resources.rc)
endif()

add_executable(App ${PROJECT_SOURCES})

target_link_libraries(App PRIVATE Qt6::Widgets Qt6::Network)

install(TARGETS App
        BUNDLE DESTINATION .
        RUNTIME DESTINATION .
)

install(DIRECTORY ${CMAKE_SOURCE_DIR}/Resources DESTINATION .)
install(DIRECTORY DESTINATION Data/Requirements)

if(WIN32)
    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    get_filename_component(_qt_bin_dir "${_qmake_executable}" DIRECTORY)
    find_program(WINDEPLOYQT_EXECUTABLE windeployqt HINTS "${_qt_bin_dir}")
    install(CODE "execute_process(COMMAND \"${WINDEPLOYQT_EXECUTABLE}\" --no-translations --compiler-runtime \"\${CMAKE_INSTALL_PREFIX}/App.exe\")" COMPONENT Runtime)
elseif(APPLE)
    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    get_filename_component(_qt_bin_dir "${_qmake_executable}" DIRECTORY)
    find_program(MACDEPLOYQT_EXECUTABLE macdeployqt HINTS "${_qt_bin_dir}")
    install(CODE "execute_process(COMMAND \"${MACDEPLOYQT_EXECUTABLE}\" \"\${CMAKE_INSTALL_PREFIX}/App.app\")" COMPONENT Runtime)
endif()

set(CPACK_PACKAGE_NAME "GUI-Video-Downloader")
set(CPACK_PACKAGE_VENDOR "Fuzja Jadrowa")
set(CPACK_PACKAGE_VERSION "1.0.0")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "GUI Video Downloader")

if(WIN32)
    set(CPACK_GENERATOR "NSIS;ZIP")
    set(CPACK_NSIS_CREATE_ICONS_EXTRA "CreateShortCut '$SMPROGRAMS\\\\$STARTMENU_FOLDER\\\\GUI Video Downloader.lnk' '$INSTDIR\\\\App.exe'")
    set(CPACK_CREATE_DESKTOP_LINKS "App")
elseif(APPLE)
    set(CPACK_GENERATOR "DragNDrop;ZIP")
else()
    set(CPACK_GENERATOR "DEB;TGZ")
endif()

include(CPack)