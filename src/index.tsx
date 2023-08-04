import React from 'react'

import { GlobalStyles } from '@contentful/f36-components'
import { SDKProvider } from '@contentful/react-apps-toolkit'
import { createRoot } from 'react-dom/client'

import App from './App'

const root = createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <SDKProvider>
    <GlobalStyles />
    <App />
  </SDKProvider>
)
