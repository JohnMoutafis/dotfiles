#!/usr/bin/env bash

if xinput list | grep -q Touchpad ; then
    sudo apt-get install -y libinput-tools xdotool wmctrl
    cd ~/.dotfiles/gestures/libinput-gestures && sudo make install
    libinput-gestures-setup autostart && libinput-gestures-setup restart
else
    echo There is no Touchpad
fi
