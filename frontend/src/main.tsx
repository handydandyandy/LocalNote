import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
// Service worker is registered automatically by vite-plugin-pwa (registerType: 'autoUpdate')
