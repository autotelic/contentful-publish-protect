/** @jsxImportSource @emotion/react */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

import { EntryFieldAPI, EntrySys, SidebarAppSDK } from '@contentful/app-sdk'
import {
  SkeletonContainer,
  SkeletonDisplayText,
  SkeletonImage,
  EntityStatus,
  FormControl
} from '@contentful/f36-components'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'
import { EntityMetaSysProps, ScheduledActionProps, SysLink } from 'contentful-management'

import AppDetailsSection from './components/AppDetailsSection'
import IssuesSection from './components/IssuesSection'
import PublishStatusSection from './components/PublishStatusSection'
import ScheduleSection from './components/ScheduleSection'

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

const getInvalidLinkMsg = (fieldName: string) => (
  `The field "${fieldName}" contains a reference to unpublished content`
)

const createInvalidLinkError = (linkMeta: LinkMeta) => ({
  ...linkMeta,
  message: getInvalidLinkMsg(linkMeta.fieldName)
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

/*
 * These are the Contentfuls recommended ways to determine an entry's status
 * https://www.contentful.com/developers/docs/tutorials/general/determine-entry-asset-state/
 */

function isChanged (sys: EntrySys | EntityMetaSysProps) {
  return !!sys.publishedVersion &&
    sys.version >= sys.publishedVersion + 2
}

function isDraft (sys: EntrySys | EntityMetaSysProps) {
  return !sys.publishedVersion
}

function isPublished (sys: EntrySys | EntityMetaSysProps) {
  return !!sys.publishedVersion &&
    // eslint-disable-next-line eqeqeq
    sys.version == sys.publishedVersion + 1
}

function isArchived (sys: EntrySys | EntityMetaSysProps) {
  return !!sys.archivedVersion
}

function getEntityStatus (sys: EntrySys | EntityMetaSysProps): EntityStatus {
  if (isArchived(sys)) return 'archived'
  if (isChanged(sys)) return 'changed'
  if (isDraft(sys)) return 'draft'
  if (isPublished(sys)) return 'published'
  return 'new'
}

async function getInvalidLink (
  linkMeta: LinkMeta,
  sdk: SidebarAppSDK
): Promise<InvalidLinkError | undefined> {
  try {
    const res = linkMeta.linkType === ASSET_CONTENT_TYPE
      ? await sdk.cma.asset.get({ assetId: linkMeta.linkId })
      : await sdk.cma.entry.get({ entryId: linkMeta.linkId })

    if (!isPublished(res.sys)) {
      return createInvalidLinkError(linkMeta)
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.message === CONTENT_NOT_FOUND_MSG || error?.code === CONTENT_NOT_FOUND_CODE) {
      return createInvalidLinkError(linkMeta)
    }
  }
}

function useInterval (callback: () => void | Promise<void>, delay: number) {
  const savedCallback = useRef<typeof callback>()

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Set up the interval.
  useEffect(() => {
    function tick () {
      savedCallback.current?.()
    }
    if (delay !== null) {
      const id = setInterval(tick, delay)
      return () => clearInterval(id)
    }
  }, [delay])
}

const Sidebar = () => {
  const sdk = useSDK<SidebarAppSDK>()
  const [invalidLinks, setInvalidLinks] = useState<InvalidLinkError[]>([])
  const [trackedFields, setTrackedFields] = useState<TrackedFieldState>({})
  const [entityStatus, setEntityStatus] = useState<EntityStatus>(getEntityStatus(sdk.entry.getSys()))
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [entityValidationId, setEntityValidationId] = useState<string | undefined>()
  const [entityValidationMsg, setEntityValidationMsg] = useState<string | undefined>()
  const [scheduledActions, setScheduledActions] = useState<ScheduledActionProps[]>([])
  const [lastSavedAt, setLastSavedAt] = useState<string>()

  const handleBulkValidate = useCallback(async () => {
    if (entityValidationId) {
      const validationResults = await sdk.cma.bulkAction.get({
        spaceId: sdk.ids.space,
        environmentId: sdk.ids.environment,
        bulkActionId: entityValidationId
      })

      if (validationResults.error) {
        setEntityValidationMsg(validationResults.error.message)
      } else {
        setEntityValidationMsg(undefined)
      }
      setEntityValidationId(undefined)
    } else {
      const { sys: { id } } = await sdk.cma.bulkAction.validate(
        {
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environment
        },
        {
          entities: {
            items: [{
              sys: {
                id: sdk.ids.entry,
                linkType: 'Entry',
                type: 'Link'
              }
            }]
          }
        }
      )
      setEntityValidationId(id)
    }
  }, [entityValidationId, sdk.cma.bulkAction, sdk.ids.entry, sdk.ids.environment, sdk.ids.space])

  useInterval(handleBulkValidate, 5000)

  const getScheduledActions = useCallback(async () => {
    const payload = await sdk.cma.scheduledActions.getMany({
      environmentId: sdk.ids.environment,
      spaceId: sdk.ids.space,
      query: {
        'entity.sys.id': sdk.ids.entry,
        'environment.sys.id': sdk.ids.environment
      }
    })
    setScheduledActions(payload.items.filter(({ sys }) => sys.status === 'scheduled'))
  }, [sdk])

  useEffect(() => {
    handleBulkValidate().then(() => handleBulkValidate())
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

    const removeOnSysChanged = sdk.entry.onSysChanged((sys) => {
      const { updatedAt } = sys
      const newStatus = getEntityStatus(sys)
      setEntityStatus(newStatus)
      setLastSavedAt(updatedAt)
      getScheduledActions()
      handleBulkValidate().then(() => handleBulkValidate())
    })

    setIsLoading(false)
    return () => {
      removeOnSysChanged()
      init.teardownHandlers.forEach((t: () => void) => { t() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk])

  useEffect(() => {
    const trackedFieldsArray = Object.values(trackedFields).flat()
    const revalidateFields = async () => {
      const results = await Promise.all(
        trackedFieldsArray.map(async (meta) => {
          if (meta) return getInvalidLink(meta, sdk)
        })
      )
      const newInvalidLinksState = results.filter(Boolean) as InvalidLinkError[]
      setInvalidLinks(newInvalidLinksState)
    }

    revalidateFields()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, trackedFields])

  useEffect(() => {
    sdk.window.startAutoResizer()
  }, [sdk.window, invalidLinks])

  const isInvalid = isLoading || invalidLinks.length > 0 || !!entityValidationMsg

  const validationMessages: string[] = useMemo(() => (
    [
      ...(entityValidationMsg ? [entityValidationMsg] : []),
      ...invalidLinks.map(({ message }) => message)
    ]
  ), [invalidLinks, entityValidationMsg])

  return isLoading
    ? (
      <SkeletonContainer>
        <SkeletonDisplayText />
        <SkeletonImage height='100%' offsetTop={37} width='100%' />
      </SkeletonContainer>
      )
    : (
      <FormControl as='div' css={css({ minHeight: '212px' })} isInvalid={isInvalid}>
        <AppDetailsSection />
        <PublishStatusSection
          entityStatus={entityStatus}
          isActionScheduled={scheduledActions.length > 0}
          isInvalid={isInvalid}
          lastSavedAt={lastSavedAt}
          triggerScheduleUpdate={getScheduledActions}
        />
        <IssuesSection validationMessages={validationMessages} />
        <ScheduleSection scheduledActions={scheduledActions} triggerScheduleUpdate={getScheduledActions} />
      </FormControl>
      )
}

export default Sidebar
