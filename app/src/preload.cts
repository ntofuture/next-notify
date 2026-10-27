import { contextBridge, ipcRenderer } from 'electron'
import type { NnApi } from './types.js'

const api: NnApi = {
  state: () => ipcRenderer.invoke('state'),
  save: (config) => ipcRenderer.invoke('save', config),
  reset: () => ipcRenderer.invoke('reset'),
  preview: (config, category, opts) => ipcRenderer.invoke('preview', config, category, opts),
  pickSound: () => ipcRenderer.invoke('pick-sound'),
  clearEvents: () => ipcRenderer.invoke('clear-events'),
  onEvents: (cb) => ipcRenderer.on('events', (_e, data) => cb(data)),
  onConfig: (cb) => ipcRenderer.on('config', (_e, config) => cb(config)),

  onShow: (cb) => ipcRenderer.on('popup:show', (_e, data) => cb(data)),
  ready: (height) => ipcRenderer.send('popup:ready', height),
  click: () => ipcRenderer.send('popup:click'),
  close: () => ipcRenderer.send('popup:close'),

  onPlay: (cb) => ipcRenderer.on('audio:play', (_e, data) => cb(data)),

  onTray: (cb) => ipcRenderer.on('tray:show', (_e, data) => cb(data)),
  traySize: (height) => ipcRenderer.send('tray:size', height),
  trayAction: (action) => ipcRenderer.send('tray:action', action),
}

contextBridge.exposeInMainWorld('nn', api)
