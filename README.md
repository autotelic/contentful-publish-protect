# Contentful Publish Protect

A Contentful app that replaces the built-in publish status/button/schedule sidebar functionality with a more secure alternative. The same features are provided in addition to stricter publishing requirements. An entry containing a link or links to unpublished (ie. draft, archived, or deleted) content will not be publishable. Additionally, apps that require the ability to have their custom fields disable the publish button are able to trigger this app's invalid state using instance params ([more details below](#externally-triggering-the-invalid-state)).

## Getting Started

Enable pnpm using [`corepack`](https://nodejs.org/api/corepack.html) (comes preinstalled with versions of Node `>=16`):

```sh
corepack enable && corepack prepare pnpm@latest --activate
```

Install dependencies

```sh
pnpm install
```

### Local Development

This app has already been installed into Autotelic's "App Testing" org/space. To view changes live on Contentful:

- Go to the App Definition page ([here](https://app.contentful.com/account/organizations/71CxCCp0OX0R8JtqEUQzhO/apps/definitions/5Nn9okXg5hzu3uDFz8OsNL/general))

- Click the "Open in Dev Mode" button

- In dev mode the app's origin can be changed at the bottom of the page in the footer/toolbox - change this to `http://localhost:3000`

- In your terminal, start the dev server (`pnpm start`)

- In the dev mode window navigate to any content entry

- In the dev mode footer/toolbox beneath the "Render's In" section click the sidebar's "Render" button

![Dev Mode Footer](docs/assets/contentful-dev-mode.png)

After following the above steps, any local changes should be reflected in the sidebar app

## App Upload and Installation

On pushes to `main`, a Github workflow will automatically upload this app to our "App Testing" Contentful org/space. All changes should be developed on and implemented in this repo and tested in our "App Testing" space first. If this app needs to be uploaded into another organization, **do not fork this repo into that org**. Instead follow the instructions below

### Adding App to a New Org

1. Create an App Definition

     ```sh
     pnpm create-app-definition
     ```

    - Run the above command from the project root, and then follow the prompts to authenticate and configure the app

      - When asked to "Select where your app can be rendered", select `App configuration screen` and `Entry sidebar`

    - The app definition should now be accessible in the org's "Apps" tab
      - Follow the [Local Development](#local-development) steps above to run the app locally and confirm it all works as expected

    - More details [here](https://www.contentful.com/developers/docs/extensibility/app-framework/create-contentful-app/#creating-an-appdefinition)

2. Build and Upload App

    ```sh
    pnpm build && pnpm upload
    ```

    - Run the above command from the project root, and then follow the prompts to authenticate and upload the app to the desired org

    - More details [here](https://www.contentful.com/developers/docs/extensibility/app-framework/create-contentful-app/#deploy-with-contentful)

3. Install and Configure App

    - In the Contentful UI navigate to the desired space within the org the app was uploaded to, and click the "Apps" tab, then click "Custom Apps"

    - Find the contentful-jsonschema-form app and select the install option.JSON-schema forms can be added to existing JSON field types

## Features

### Externally triggering the invalid state

Currently the Contentful app SDK does not provide a means to set the validity of an entry. The app field SDK has the `setInvalid` method, but it is only able to set the view-state of the field and is not able trigger a failed validation and disable publishing. Contentful Publish Protect allows for its invalid state to be triggered via instance params. The following hook provides a function that will handle toggling the invalid state of contentful-publish-protect.

```js
import { useEffect, useState } from 'react'

import { FieldAppSDK } from '@contentful/app-sdk'
import { useSDK } from '@contentful/react-apps-toolkit'
import { Control } from 'contentful-management'
import throttle from 'lodash.throttle'

// This is the key that contentful-publish-protect looks for
const INVALID_PARAM_KEY = '__invalid'

const usePublishProtect = (): [boolean, (isValid: boolean) => void] => {
  const sdk = useSDK<FieldAppSDK>()
  const [isValid, setIsValid] = useState<boolean>(false)
  useEffect(() => {
    // Throttled so this can be used in frequently invoked event handlers
    const setInstanceValidity = throttle(async () => {
      sdk.field.setInvalid(!isValid)

      const editorInterface = await sdk.cma.editorInterface.get({
        environmentId: sdk.ids.environment,
        spaceId: sdk.ids.space,
        contentTypeId: sdk.ids.contentType
      })

      const appControl = editorInterface?.controls?.find(({ fieldId, widgetId }) => (
        fieldId === sdk.ids.field && widgetId === sdk.ids.app
      )) ?? {} as Control

      const invalidEntryIds = (appControl?.settings?.[INVALID_PARAM_KEY] as string)?.split(',') ?? []

      const updatedInvalidEntryIds = invalidEntryIds.reduce((acc, entryId) => {
        if (entryId) {
          if (entryId === sdk.ids.entry) {
            if (!isValid) {
              acc.push(entryId)
            }
          } else {
            acc.push(entryId)
          }
        }
        return acc
      }, [] as string[])

      if (!isValid && !updatedInvalidEntryIds.includes(sdk.ids.entry)) {
        updatedInvalidEntryIds.push(sdk.ids.entry)
      }

      const updatedControls = editorInterface?.controls?.map((control) => {
        const { fieldId, widgetId } = control
        if (fieldId === sdk.ids.field && widgetId === sdk.ids.app) {
          const updatedAppControl = {
            ...(appControl ?? {}),
            settings: {
              ...(appControl?.settings ?? {}),
              // Instance parameter values can only be strings, booleans, or numbers
              [INVALID_PARAM_KEY]: updatedInvalidEntryIds.join(',')
            }
          }
          return updatedAppControl
        }
        return control
      })

      await sdk.cma.editorInterface.update({
        environmentId: sdk.ids.environment,
        spaceId: sdk.ids.space,
        contentTypeId: sdk.ids.contentType
      }, {
        ...editorInterface,
        controls: updatedControls
      })
    }, 500, { leading: false, trailing: true })

    setInstanceValidity()

    return () => {
      setInstanceValidity.cancel()
    }
  }, [isValid, sdk])

  // Use setIsValid in your app's field component to set contentful-publish-protect's invalid state
  return [isValid, setIsValid]
}

```
