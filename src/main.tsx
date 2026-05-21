import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Admin from './Admin.tsx'
import './index.css'

const path = window.location.pathname
const isAdmin = path === '/admin' || path === '/admin/'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </React.StrictMode>,
)