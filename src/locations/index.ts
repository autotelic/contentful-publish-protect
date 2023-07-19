import { locations } from '@contentful/app-sdk'

import ConfigScreen from './configScreen'
import Dialogue from './dialogue'
import Sidebar from './sidebar'

export default {
  [locations.LOCATION_APP_CONFIG]: ConfigScreen,
  [locations.LOCATION_DIALOG]: Dialogue,
  [locations.LOCATION_ENTRY_SIDEBAR]: Sidebar
}
