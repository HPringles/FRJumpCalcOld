const {app, BrowserWindow} = require("electron")
const url = require('url')
const path = require('path')
require("electron-debug")({showDevTools: true, enabled: false})

let win

function createWindow() {
    win = new BrowserWindow({width:800, height:600})
    win.loadURL(url.format({
        pathname: __dirname + '/build/index.html',
        protocol: 'file:',
        slashes: true
    }))

}

app.on('ready', createWindow)


