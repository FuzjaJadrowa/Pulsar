cmake_minimum_required(VERSION 3.16)

project(Pulsar VERSION 2.1.0)
set(APP_VERSION "${Pulsar_VERSION}")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Widgets Network Gui Core Svg REQUIRED)

if(APPLE)
    set(CMAKE_INSTALL_RPATH "@executable_path/../Frameworks")
elseif(UNIX)
    set(CMAKE_INSTALL_RPATH "$ORIGIN/lib:$ORIGIN/../lib:$ORIGIN/")
endif()

set(PROJECT_SOURCES
        main.cpp
        App/Gui/downloader_page.cpp App/Gui/downloader_page.h
        App/Gui/settings_page.cpp App/Gui/settings_page.h
        App/Gui/console_page.cpp App/Gui/console_page.h
        App/Gui/queue_panel.cpp App/Gui/queue_panel.h
        App/Gui/container.cpp App/Gui/container.h
        App/Gui/components.cpp App/Gui/components.h
        App/Gui/queue_panel.cpp App/Gui/queue_panel.h
        App/Core/downloader.cpp App/Core/downloader.h
        App/Core/config_manager.cpp App/Core/config_manager.h
        App/Core/queue_manager.cpp App/Core/queue_manager.h
        App/Core/popup.cpp App/Core/popup.h
        App/Core/splash_screen.cpp App/Core/splash_screen.h
        App/Core/queue_manager.cpp App/Core/queue_manager.h
        resources.qrc
)

if(WIN32)
    list(APPEND PROJECT_SOURCES resources.rc)
    add_executable(Pulsar WIN32 ${PROJECT_SOURCES})
elseif(APPLE)
    add_executable(Pulsar MACOSX_BUNDLE ${PROJECT_SOURCES})
else()
    add_executable(Pulsar ${PROJECT_SOURCES})
endif()

target_link_libraries(Pulsar PRIVATE Qt6::Widgets Qt6::Network Qt6::Gui Qt6::Core Qt6::Svg)

if(WIN32)
    target_link_libraries(Pulsar PRIVATE dwmapi)
endif()

if(WIN32)
    install(TARGETS Pulsar RUNTIME DESTINATION .)
    install(FILES "${CMAKE_SOURCE_DIR}/LICENSE.txt" DESTINATION .)

    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    get_filename_component(_qt_bin_dir "${_qmake_executable}" DIRECTORY)
    find_program(WINDEPLOYQT_EXECUTABLE windeployqt HINTS "${_qt_bin_dir}")

    install(CODE "
        execute_process(COMMAND \"${WINDEPLOYQT_EXECUTABLE}\" --no-translations --compiler-runtime \"\${CMAKE_INSTALL_PREFIX}/Pulsar.exe\")
    ")

elseif(APPLE)
    set_target_properties(Pulsar PROPERTIES
            MACOSX_BUNDLE_BUNDLE_NAME "Pulsar"
            MACOSX_BUNDLE_GUI_IDENTIFIER "com.fuzjajadrowa.pulsar"
            MACOSX_BUNDLE_ICON_FILE "icon.icns"
            MACOSX_BUNDLE_INFO_STRING "Pulsar ${APP_VERSION}"
            MACOSX_BUNDLE_SHORT_VERSION_STRING "${APP_VERSION}"
            MACOSX_BUNDLE_BUNDLE_VERSION "${APP_VERSION}"
            MACOSX_BUNDLE_COPYRIGHT "Copyright (c) 2026 Fuzja Jadrowa"
    )

    if(EXISTS "${CMAKE_SOURCE_DIR}/Resources/Icons/icon.icns")
        set_source_files_properties(Resources/Icons/icon.icns PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
        target_sources(Pulsar PRIVATE Resources/Icons/icon.icns)
    endif()

    install(TARGETS Pulsar BUNDLE DESTINATION .)

    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    get_filename_component(_qt_bin_dir "${_qmake_executable}" DIRECTORY)
    find_program(MACDEPLOYQT_EXECUTABLE macdeployqt HINTS "${_qt_bin_dir}")

    install(CODE "
        execute_process(COMMAND \"${MACDEPLOYQT_EXECUTABLE}\" \"\${CMAKE_INSTALL_PREFIX}/Pulsar.app\" \"-always-overwrite\" \"-codesign=-\")
    " COMPONENT Runtime)

else()
    set(CPACK_PACKAGING_INSTALL_PREFIX "/opt/Pulsar")

    install(TARGETS Pulsar RUNTIME DESTINATION bin)

    if(EXISTS "${CMAKE_SOURCE_DIR}/LICENSE")
        install(FILES "${CMAKE_SOURCE_DIR}/LICENSE" DESTINATION share/doc/pulsar)
    endif()

    install(FILES "Resources/Icons/icon.png" DESTINATION share/icons/hicolor/512x512/apps RENAME pulsar.png)

    get_target_property(_qmake_executable Qt6::qmake IMPORTED_LOCATION)
    execute_process(COMMAND "${_qmake_executable}" -query QT_INSTALL_PLUGINS
            OUTPUT_VARIABLE QT_PLUGINS_DIR
            OUTPUT_STRIP_TRAILING_WHITESPACE)

    foreach(PLUGIN_DIR platforms platformthemes styles imageformats iconengines tls)
        if(EXISTS "${QT_PLUGINS_DIR}/${PLUGIN_DIR}")
            install(DIRECTORY "${QT_PLUGINS_DIR}/${PLUGIN_DIR}" DESTINATION plugins)
        endif()
    endforeach()

    file(WRITE "${CMAKE_BINARY_DIR}/qt.conf"
            "[Paths]\n"
            "Prefix = ..\n"
            "Plugins = plugins\n"
    )
    install(FILES "${CMAKE_BINARY_DIR}/qt.conf" DESTINATION bin)

    set(DESKTOP_FILE "${CMAKE_BINARY_DIR}/pulsar.desktop")
    file(WRITE "${DESKTOP_FILE}"
            "[Desktop Entry]\n"
            "Type=Application\n"
            "Name=Pulsar\n"
            "Exec=/opt/Pulsar/bin/Pulsar\n"
            "Icon=/opt/Pulsar/share/icons/hicolor/512x512/apps/pulsar.png\n"
            "Categories=Network;Utility;\n"
            "Terminal=false\n"
    )
    install(FILES "${DESKTOP_FILE}" DESTINATION share/applications)

    find_program(LINUXDEPLOYQT_EXECUTABLE linuxdeployqt)

    if(LINUXDEPLOYQT_EXECUTABLE)
        install(CODE "
            set(DESTDIR \"\$ENV{DESTDIR}\")
            set(APP_BIN \"\${DESTDIR}\${CMAKE_INSTALL_PREFIX}/bin/Pulsar\")
            execute_process(
                COMMAND \"${LINUXDEPLOYQT_EXECUTABLE}\" \"\${APP_BIN}\" -always-overwrite -unsupported-allow-new-glibc -extra-plugins=platformthemes,platforms
            )
        " COMPONENT Runtime)
    endif()
endif()

set(CPACK_PACKAGE_NAME "Pulsar")
set(CPACK_PACKAGE_VENDOR "Fuzja Jadrowa")
set(CPACK_PACKAGE_VERSION "${APP_VERSION}")
set(CPACK_PACKAGE_CONTACT "https://github.com/FuzjaJadrowa")
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_SOURCE_DIR}/LICENSE.txt")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "High-performance, cross-platform utility designed to redefine how you acquire and manage digital media.")

if(WIN32)
    set(CPACK_GENERATOR "ZIP;NSIS")
    set(CPACK_PACKAGE_INSTALL_DIRECTORY "Pulsar")
    set(CPACK_NSIS_MUI_ICON "${CMAKE_SOURCE_DIR}/Resources/Icons/icon.ico")
    set(CPACK_NSIS_MUI_UNIICON "${CMAKE_SOURCE_DIR}/Resources/Icons/icon.ico")
    set(CPACK_NSIS_DISPLAY_NAME "Pulsar")
    set(CPACK_NSIS_URL_INFO_ABOUT "https://github.com/FuzjaJadrowa/Pulsar")
    set(CPACK_NSIS_CREATE_ICONS_EXTRA "
        CreateShortCut '$SMPROGRAMS\\\\$STARTMENU_FOLDER\\\\Pulsar.lnk' '$INSTDIR\\\\Pulsar.exe'
    ")
    set(CPACK_NSIS_DELETE_ICONS_EXTRA "
        Delete '$SMPROGRAMS\\\\$STARTMENU_FOLDER\\\\Pulsar.lnk'
    ")
    set(CPACK_CREATE_DESKTOP_LINKS "Pulsar")

elseif(APPLE)
    set(CPACK_GENERATOR "DragNDrop;ZIP")
    set(CPACK_DMG_VOLUME_NAME "Pulsar")
    set(CPACK_SYSTEM_NAME "MacOS")

else()
    set(CPACK_GENERATOR "DEB;TGZ")
    set(CPACK_SYSTEM_NAME "Linux")
    set(CPACK_DEBIAN_PACKAGE_MAINTAINER "Fuzja Jadrowa")
    set(CPACK_DEBIAN_PACKAGE_DEPENDS "libc6 (>= 2.34), libgcc-s1 (>= 3.0), libstdc++6 (>= 11)")
    set(CPACK_DEBIAN_PACKAGE_SHLIBDEPS ON)
    set(CPACK_PACKAGING_INSTALL_PREFIX "/opt/Pulsar")
endif()

include(CPack)