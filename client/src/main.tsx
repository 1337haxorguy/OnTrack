import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.tsx'
import TestGenerate from './pages/TestGenerate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain="dev-ni8q0awoq86bppws.us.auth0.com"
      clientId="3o6VYphfSiCRq86dmuTe9N3XOBbEIEW6"
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: "https://ontrack-api",
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/test" element={<TestGenerate />} />
        </Routes>
      </BrowserRouter>
    </Auth0Provider>
  </StrictMode>,
)