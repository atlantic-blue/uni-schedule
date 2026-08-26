import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createApi } from './lib/createApi'
import './index.css'

const { api, isDemo } = createApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} isDemo={isDemo} />
  </StrictMode>,
)
