cmake_minimum_required(VERSION 3.16)
project(GUIVideoDownloader)

set(APP_NAME "GUIVideoDownloader")
set(APP_VERSION "2.0.1")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Widgets Network REQUIRED)

set(PROJECT_SOURCES
        main.cpp
        Installer/installer_window.cpp Installer/installer_window.h
        App/popup.cpp App/popup.h
        App/settings_page.cpp App/settings_page.h
        App/console_page.cpp App/console_page.h
        App/main_page.cpp App/main_page.h
        App/config_manager.cpp App/config_manager.h
        App/downloader.cpp App/downloader.h
        Installer/app_updater.cpp Installer/app_updater.h
        resources.qrc
)

if(WIN32)
    list(APPEND PROJECT_SOURCES resources.rc)
    add_executable(${APP_NAME} WIN32 ${PROJECT_SOURCES})
elseif(APPLE)
    list(APPEND PROJECT_SOURCES Resources/Icons/icon.icns)
    add_executable(${APP_NAME} ${PROJECT_SOURCES})
else()
    add_executable(${APP_NAME} ${PROJECT_SOURCES})
endif()

target_link_libraries(${APP_NAME} PRIVATE Qt6::Widgets Qt6::Network)

if(WIN32)
    install(TARGETS ${APP_NAME} RUNTIME DESTINATION .)
    install(FILES "${CMAKE_SOURCE_DIR}/LICENSE" DESTINATION .)

    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    get_filename_component(_qt_bin_dir "${_qmake_executable}" DIRECTORY)
    find_program(WINDEPLOYQT_EXECUTABLE windeployqt HINTS "${_qt_bin_dir}")

    install(CODE "
        execute_process(COMMAND \"${WINDEPLOYQT_EXECUTABLE}\" --no-translations --compiler-runtime \"\${CMAKE_INSTALL_PREFIX}/App.exe\")
    ")

elseif(APPLE)
    set_target_properties(${APP_NAME} PROPERTIES
            MACOSX_BUNDLE TRUE
            MACOSX_BUNDLE_BUNDLE_NAME "GUI Video Downloader"
            MACOSX_BUNDLE_GUI_IDENTIFIER "com.fuzjajadrowa.gvd"
            MACOSX_BUNDLE_ICON_FILE "icon.icns"
            MACOSX_BUNDLE_INFO_STRING "GUI Video Downloader ${APP_VERSION}"
            MACOSX_BUNDLE_SHORT_VERSION_STRING "${APP_VERSION}"
            MACOSX_BUNDLE_BUNDLE_VERSION "${APP_VERSION}"
            MACOSX_BUNDLE_COPYRIGHT "Copyright (c) 2026 Fuzja Jadrowa"
    )
    set_source_files_properties(Resources/Icons/icon.icns PROPERTIES MACOSX_PACKAGE_LOCATION Resources)

    install(TARGETS ${APP_NAME} BUNDLE DESTINATION .)

    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    get_filename_component(_qt_bin_dir "${_qmake_executable}" DIRECTORY)
    find_program(MACDEPLOYQT_EXECUTABLE macdeployqt HINTS "${_qt_bin_dir}")

    install(CODE "
        execute_process(COMMAND \"${MACDEPLOYQT_EXECUTABLE}\" \"\${CMAKE_INSTALL_PREFIX}/App.app\" \"-always-overwrite\" \"-codesign=-\")
    " COMPONENT Runtime)

else()
    set(DESKTOP_FILE "${CMAKE_BINARY_DIR}/guivideodownloader.desktop")
    file(WRITE "${DESKTOP_FILE}"
            "[Desktop Entry]\n"
            "Type=Application\n"
            "Name=GUI Video Downloader\n"
            "Comment=A helpful tool for downloading media from various sites.\n"
            "Exec=App\n"
            "Icon=guivideodownloader\n"
            "Categories=Network;Utility;\n"
            "Terminal=false\n"
    )

    install(TARGETS ${APP_NAME} RUNTIME DESTINATION bin)
    install(FILES "${DESKTOP_FILE}" DESTINATION share/applications)
    install(FILES "Resources/Icons/icon.png"
            DESTINATION share/icons/hicolor/512x512/apps
            RENAME guivideodownloader.png)
    install(FILES "${CMAKE_SOURCE_DIR}/LICENSE" DESTINATION share/doc/guivideodownloader)
    install(DIRECTORY ${CMAKE_SOURCE_DIR}/Resources DESTINATION share/guivideodownloader)
endif()

set(CPACK_PACKAGE_NAME "GUI-Video-Downloader")
set(CPACK_PACKAGE_VENDOR "Fuzja Jadrowa")
set(CPACK_PACKAGE_VERSION "${APP_VERSION}")
set(CPACK_PACKAGE_CONTACT "Fuzja Jadrowa")
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_SOURCE_DIR}/LICENSE")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "A helpful tool for downloading media from various sites.")

if(WIN32)
    set(CPACK_GENERATOR "ZIP;NSIS")
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
    set(CPACK_GENERATOR "ZIP;DragNDrop")
    set(CPACK_SYSTEM_NAME "Darwin")

else()
    set(CPACK_GENERATOR "TGZ;DEB")
    set(CPACK_SYSTEM_NAME "Linux")

    set(CPACK_DEBIAN_PACKAGE_LICENSE "MIT")
    set(CPACK_DEBIAN_PACKAGE_DEPENDS "libqt6widgets6, libqt6network6, libqt6gui6, libqt6core6")
    set(CPACK_PACKAGING_INSTALL_PREFIX "/usr")
endif()

include(CPack)