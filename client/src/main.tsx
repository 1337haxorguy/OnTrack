import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.tsx'

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
      <App />
    </Auth0Provider>
  </StrictMode>,
)