/** @jsxImportSource @emotion/react */

import React, { useCallback, useState, useEffect } from 'react'

import { AppState, ConfigAppSDK } from '@contentful/app-sdk'
import { Heading, Form, Paragraph, Checkbox } from '@contentful/f36-components'
import tokens from '@contentful/f36-tokens'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'

import { AppInstallationParameters } from '../../types'

const styles = {
  body: css({
    height: 'auto',
    minHeight: '65vh',
    margin: '0 auto',
    marginTop: tokens.spacingXl,
    padding: `${tokens.spacingXl} ${tokens.spacing2Xl}`,
    maxWidth: tokens.contentWidthText,
    backgroundColor: tokens.colorWhite,
    zIndex: 2,
    boxShadow: '0px 0px 20px rgba(0, 0, 0, 0.1)',
    borderRadius: '2px'
  })
}

const ConfigScreen = () => {
  const [parameters, setParameters] = useState<AppInstallationParameters>({ contentTypes: [] })
  const [availableContentTypes, setAvailableContentTypes] = useState<Record<'id' | 'name', string>[]>([])
  const sdk = useSDK<ConfigAppSDK>()

  const onConfigure = useCallback(async () => {
    const currentState = await sdk.app.getCurrentState()

    const selectedCTs = parameters.contentTypes.reduce((acc, ctId) => {
      acc[ctId] = {
        sidebar: { position: 0 }
      }
      return acc
    }, {} as AppState['EditorInterface'])

    // Remove publish button from sidebar.
    await Promise.all(parameters.contentTypes.map(async (contentTypeId) => {
      const ei = await sdk.cma.editorInterface.get({ contentTypeId })
      const sidebar = (ei.sidebar ?? []).map((widget) => ({
        ...widget,
        disabled: widget.widgetId === 'publication-widget'
      }))
      return sdk.cma.editorInterface.update({ contentTypeId }, { ...ei, sidebar })
    }))

    return {
      parameters,
      targetState: {
        EditorInterface: {
          ...currentState?.EditorInterface,
          ...selectedCTs
        }
      }
    }
  }, [parameters, sdk])

  useEffect(() => {
    sdk.app.onConfigure(() => onConfigure())
  }, [sdk, onConfigure])

  useEffect(() => {
    (async () => {
      const cts = await sdk.cma.contentType.getMany({
        spaceId: sdk.ids.space,
        environmentId: sdk.ids.environmentAlias ?? sdk.ids.environment
      })

      setAvailableContentTypes(cts.items.map(({ sys, name }) => ({ id: sys.id, name })))

      const editorInterfaces = await sdk.cma.editorInterface.getMany({
        spaceId: sdk.ids.space,
        environmentId: sdk.ids.environmentAlias ?? sdk.ids.environment
      })

      const assignedCts = editorInterfaces.items.reduce((acc, ei) => {
        if (ei.sidebar?.some((widget) => (
          widget.widgetId === sdk.ids.app && widget.widgetNamespace === 'app'
        ))) {
          acc.push(ei.sys.contentType.sys.id)
        }
        return acc
      }, [] as string[])

      const {
        contentTypes = [],
        ...restParams
      }: AppInstallationParameters = await sdk.app.getParameters() ?? parameters

      setParameters({
        ...restParams,
        contentTypes: assignedCts ?? contentTypes
      })
      sdk.app.setReady()
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk])

  const handleCtSelect = (value: string, isChecked: boolean) => {
    setParameters({
      ...parameters,
      contentTypes: !isChecked
        ? parameters.contentTypes.concat([value])
        : parameters.contentTypes.filter((ctId) => ctId !== value)
    })
  }

  return (
    <div css={styles.body}>
      <Form css={css({ margin: 'auto', width: 'fit-content' })}>
        <Heading>Contentful Publish Protect</Heading>
        <Paragraph>Select the content types that will be using this app</Paragraph>
        {availableContentTypes.map(({ id, name }) => {
          const isChecked = parameters.contentTypes.includes(id)
          return (
            <Checkbox
              key={id}
              isChecked={isChecked}
              css={css({
                margin: tokens.spacingM
              })}
              onChange={() => {
                handleCtSelect(id, isChecked)
              }}
            >
              {name}
            </Checkbox>
          )
        })}
      </Form>
    </div>
  )
}

export default ConfigScreen
