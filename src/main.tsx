import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const isAdmin = window.location.pathname.startsWith('/admin')

async function loadApp() {
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  if (isAdmin) {
    const { default: Admin } = await import('./Admin.tsx')
    root.render(<React.StrictMode><Admin /></React.StrictMode>)
  } else {
    const { default: App } = await import('./App.tsx')
    root.render(<React.StrictMode><App /></React.StrictMode>)
  }
}

loadApp()