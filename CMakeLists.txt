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
        resources.qrc
        App/downloader.cpp
        App/downloader.h
        Installer/app_updater.cpp
        Installer/app_updater.h
)

if(WIN32)
    list(APPEND PROJECT_SOURCES resources.rc)
endif()


if(WIN32)
    add_executable(App WIN32 ${PROJECT_SOURCES})
else()
    add_executable(App ${PROJECT_SOURCES})
endif()


if(APPLE)
    set_target_properties(App PROPERTIES
            MACOSX_BUNDLE TRUE
            MACOSX_BUNDLE_BUNDLE_NAME "GUI Video Downloader"
            MACOSX_BUNDLE_GUI_IDENTIFIER "com.fuzjajadrowa.gvd"
            MACOSX_BUNDLE_ICON_FILE "icon.icns"
    )
    set_source_files_properties(Resources/Icons/icon.icns PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
endif()

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


    add_custom_command(TARGET App POST_BUILD
            COMMAND "${WINDEPLOYQT_EXECUTABLE}" --no-translations --compiler-runtime --dir "$<TARGET_FILE_DIR:App>" "$<TARGET_FILE:App>"
            COMMENT "Running windeployqt to deploy dependencies..."
    )


    install(CODE "
        file(GLOB_RECURSE QT_DLLS \"\${CMAKE_CURRENT_BINARY_DIR}/*.dll\")
        file(INSTALL \${QT_DLLS} DESTINATION \"\${CMAKE_INSTALL_PREFIX}\")
    ")


    set(QT_PLUGINS platforms styles imageformats iconengines tls networkinformation)
    foreach(PLUGIN ${QT_PLUGINS})
        install(DIRECTORY "${CMAKE_BINARY_DIR}/${PLUGIN}" DESTINATION . OPTIONAL)
    endforeach()

elseif(APPLE)

    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    get_filename_component(_qt_bin_dir "${_qmake_executable}" DIRECTORY)
    find_program(MACDEPLOYQT_EXECUTABLE macdeployqt HINTS "${_qt_bin_dir}")

    install(CODE "
        execute_process(COMMAND \"${MACDEPLOYQT_EXECUTABLE}\" \"\${CMAKE_INSTALL_PREFIX}/App.app\")
    " COMPONENT Runtime)
endif()

set(CPACK_PACKAGE_NAME "GUI-Video-Downloader")
set(CPACK_PACKAGE_VENDOR "Fuzja Jadrowa")
set(CPACK_PACKAGE_VERSION "2.0.0")
set(CPACK_PACKAGE_INSTALL_DIRECTORY "GUI Video Downloader")
set(CPACK_PACKAGE_CONTACT "fuzjajadrowa")
set(CPACK_DEBIAN_PACKAGE_MAINTAINER "fuzjajadrowa")

if(WIN32)
    set(CPACK_GENERATOR "NSIS;ZIP")

    set(CPACK_NSIS_MUI_ICON "${CMAKE_SOURCE_DIR}/Resources/Icons/installer_icon.ico")
    set(CPACK_NSIS_MUI_UNIICON "${CMAKE_SOURCE_DIR}/Resources/Icons/installer_icon.ico")

    set(CPACK_NSIS_DISPLAY_NAME "GUI Video Downloader")
    set(CPACK_NSIS_HELP_LINK "https://tipply.pl/@fuzjajadrowa")
    set(CPACK_NSIS_URL_INFO_ABOUT "https://tipply.pl/@fuzjajadrowa")
    set(CPACK_NSIS_CREATE_ICONS_EXTRA "
        CreateShortCut '$SMPROGRAMS\\\\$STARTMENU_FOLDER\\\\GUI Video Downloader.lnk' '$INSTDIR\\\\App.exe'
    ")
    set(CPACK_NSIS_DELETE_ICONS_EXTRA "
        Delete '$SMPROGRAMS\\\\$STARTMENU_FOLDER\\\\GUI Video Downloader.lnk'
    ")
    set(CPACK_CREATE_DESKTOP_LINKS "App")

elseif(APPLE)
    set(CPACK_GENERATOR "DragNDrop;ZIP")
else()
    set(CPACK_GENERATOR "DEB;TGZ")
endif()

include(CPack)