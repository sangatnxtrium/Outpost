import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const path = window.location.pathname

async function loadApp() {
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  if (path.startsWith('/admin')) {
    const { default: Admin } = await import('./Admin.tsx')
    root.render(<React.StrictMode><Admin /></React.StrictMode>)
  } else if (path.startsWith('/privacy')) {
    const { PrivacyPolicy } = await import('./Legal.tsx')
    root.render(<React.StrictMode><PrivacyPolicy /></React.StrictMode>)
  } else if (path.startsWith('/terms')) {
    const { TermsOfService } = await import('./Legal.tsx')
    root.render(<React.StrictMode><TermsOfService /></React.StrictMode>)
  } else {
    const { default: App } = await import('./App.tsx')
    root.render(<React.StrictMode><App /></React.StrictMode>)
  }
}

loadApp()