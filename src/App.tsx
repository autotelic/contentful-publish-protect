import React, { useMemo } from 'react'

import { useSDK } from '@contentful/react-apps-toolkit'

import locations from './locations'

const App = () => {
  const sdk = useSDK()

  const Component = useMemo(() => {
    for (const [location, component] of Object.entries(locations)) {
      if (sdk.location.is(location)) {
        return component
      }
    }
  }, [sdk.location])

  return Component ? <Component /> : null
}

export default App
