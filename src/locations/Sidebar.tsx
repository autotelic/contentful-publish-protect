/** @jsxImportSource @emotion/react */

import React, { useState, useEffect } from 'react'

import { EntryFieldAPI, SidebarAppSDK } from '@contentful/app-sdk'
import { List, ListItem, Note } from '@contentful/f36-components'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'
import { SysLink } from 'contentful-management'

const LINK_CONTENT_TYPE = 'Link'
const ASSET_CONTENT_TYPE = 'Asset'
const ARRAY_CONTENT_TYPE = 'Array'
const CONTENT_NOT_FOUND_MSG = 'The resource could not be found.'
const CONTENT_NOT_FOUND_CODE = 'a'

interface LinkMeta {
  fieldId: string
  fieldName: string
  linkId: string,
  linkType: string
}

interface InvalidLinkError extends LinkMeta {
  message: string
}

type TrackedFieldState = Record<string, LinkMeta[]>

const createInvalidLinkError = (linkMeta: LinkMeta) => ({
  ...linkMeta,
  message: `The field "${linkMeta.fieldName}" contains a reference to unpublished content`
})

const getLinkMeta = (field: EntryFieldAPI, link: SysLink) => {
  const linkArr = Array.isArray(link) ? link : [link]
  return linkArr.map(({ sys }) => ({
    fieldId: field.id,
    fieldName: field.name,
    linkId: sys.id,
    linkType: sys.linkType
  }))
}

async function getInvalidLink (
  linkMeta: LinkMeta,
  sdk: SidebarAppSDK
): Promise<InvalidLinkError | undefined> {
  try {
    const res = linkMeta.linkType === ASSET_CONTENT_TYPE
      ? await sdk.cma.asset.get({ assetId: linkMeta.linkId })
      : await sdk.cma.entry.get({ entryId: linkMeta.linkId })

    if (!res.sys.publishedAt) {
      return createInvalidLinkError(linkMeta)
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.message === CONTENT_NOT_FOUND_MSG || error?.code === CONTENT_NOT_FOUND_CODE) {
      return createInvalidLinkError(linkMeta)
    }
  }
}

const Sidebar = () => {
  const [invalidLinks, setInvalidLinks] = useState<InvalidLinkError[]>([])
  const [trackedFields, setTrackedFields] = useState<TrackedFieldState>({})
  const sdk = useSDK<SidebarAppSDK>()

  useEffect(() => {
    const init = Object.values(sdk.entry.fields).reduce((acc, field) => {
      if (field.type === LINK_CONTENT_TYPE ||
        (field.type === ARRAY_CONTENT_TYPE && field.items.type === LINK_CONTENT_TYPE)
      ) {
        const initialValue = field.getValue()
        // Set initial value of tracked field
        acc.state[field.id] = initialValue ? getLinkMeta(field, initialValue) : []

        // Update internal state whenever a tracked field changes
        const teardownHandler = field.onValueChanged((value) => {
          setTrackedFields({
            ...trackedFields,
            [field.id]: value ? getLinkMeta(field, value) : []
          })
        })
        acc.teardownHandlers.push(teardownHandler)
      }
      return acc
    }, {
      teardownHandlers: [],
      state: {}
    } as { teardownHandlers: Array<() => void>, state: TrackedFieldState })

    setTrackedFields(init.state)

    return () => {
      init.teardownHandlers.forEach((t: () => void) => { t() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const trackedFieldsArray = Object.values(trackedFields).flat()
    const revalidateFields = async () => {
      const results = await Promise.all(
        trackedFieldsArray.map(async (meta) => {
          if (meta) return getInvalidLink(meta, sdk)
        })
      )
      setInvalidLinks(results.filter(Boolean) as InvalidLinkError[])
    }
    revalidateFields()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, trackedFields])

  if (invalidLinks.length) {
    return (
      <Note css={css({ marginBottom: '12px' })} variant='negative'>
        The following validation errors have occurred
        <List>
          {invalidLinks.map(({ message }, index) => (
            <ListItem key={index}>
              {message}
            </ListItem>
          ))}
        </List>
      </Note>
    )
  }
  return (
    <Note css={css({ marginBottom: '12px' })} variant='positive'>
      Contentful Publish Protect
    </Note>
  )
}

export default Sidebar
