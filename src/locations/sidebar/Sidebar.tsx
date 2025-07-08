/** @jsxImportSource @emotion/react */

import React, { useState, useEffect, useCallback, useMemo } from 'react'

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
import throttle from 'lodash.throttle'

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

const INVALID_PARAM_KEY = '__invalid'

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
 * These are the Contentful's recommended ways to determine an entry's status
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

    if (isDraft(res.sys) || isArchived(res.sys)) {
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
  const sdk = useSDK<SidebarAppSDK>()
  const [invalidLinks, setInvalidLinks] = useState<InvalidLinkError[]>([])
  const [customFieldErrors, setCustomFieldErrors] = useState<string[]>([])
  const [trackedFields, setTrackedFields] = useState<TrackedFieldState>({})
  const [entityStatus, setEntityStatus] = useState<EntityStatus>(getEntityStatus(sdk.entry.getSys()))
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [entityValidationId, setEntityValidationId] = useState<string | undefined>()
  const [entityValidationMsg, setEntityValidationMsg] = useState<string | undefined>()
  const [scheduledActions, setScheduledActions] = useState<ScheduledActionProps[]>([])
  const [lastSavedAt, setLastSavedAt] = useState<string>()

  const getScheduledActions = useCallback(async () => {
    const payload = await sdk.cma.scheduledActions.getMany({
      environmentId: sdk.ids.environmentAlias ?? sdk.ids.environment,
      spaceId: sdk.ids.space,
      query: {
        'entity.sys.id': sdk.ids.entry,
        'environment.sys.id': sdk.ids.environmentAlias ?? sdk.ids.environment
      }
    })
    setScheduledActions(payload.items.filter(({ sys }) => sys.status === 'scheduled'))
  }, [sdk])

  const handleBulkValidate = useMemo(() => throttle(
    async () => {
      if (!entityValidationId) {
        setIsValidating(true)
        await sdk.entry.save()
        const { sys: { id } } = await sdk.cma.bulkAction.validate(
          {
            spaceId: sdk.ids.space,
            environmentId: sdk.ids.environmentAlias ?? sdk.ids.environment
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
    }, 300, { trailing: true, leading: false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [entityValidationId])

  useEffect(() => {
    const checkValidationResults = async () => {
      const { controls = [] } = await sdk.cma.editorInterface.get({
        environmentId: sdk.ids.environmentAlias ?? sdk.ids.environment,
        spaceId: sdk.ids.space,
        contentTypeId: sdk.ids.contentType
      })

      const invalidCustomFields = controls.filter(({ settings = {} }) => (
        (settings?.[INVALID_PARAM_KEY] as string)?.split(',').includes(sdk.ids.entry))
      )

      if (invalidCustomFields.length) {
        const errorMsgs = invalidCustomFields.map(({ fieldId }) => {
          const fieldName = sdk.entry.fields[fieldId].name
          return `The field "${fieldName}" is invalid`
        })
        setCustomFieldErrors(errorMsgs)
      } else {
        setCustomFieldErrors([])
      }

      if (entityValidationId) {
        const validationResults = await sdk.cma.bulkAction.get({
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environmentAlias ?? sdk.ids.environment,
          bulkActionId: entityValidationId
        })
        if (validationResults.error) {
          setEntityValidationMsg(validationResults.error.message)
        } else {
          setEntityValidationMsg(undefined)
        }
        setEntityValidationId(undefined)
        setIsValidating(false)
      }
    }
    checkValidationResults()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityValidationId])

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
          handleBulkValidate()
        })
        acc.teardownHandlers.push(teardownHandler)
      } else {
        const teardownHandler = field.onValueChanged(handleBulkValidate)
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
      handleBulkValidate()
    })

    setIsLoading(false)
    return () => {
      removeOnSysChanged()
      init.teardownHandlers.forEach((t: () => void) => { t() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getScheduledActions, sdk])

  useEffect(() => {
    const trackedFieldsArray = Object.values(trackedFields).flat()
    const revalidateFields = async () => {
      setIsValidating(true)
      const results = await Promise.all(
        trackedFieldsArray.map(async (meta) => {
          if (meta) return getInvalidLink(meta, sdk)
        })
      )
      const newInvalidLinksState = results.filter(Boolean) as InvalidLinkError[]
      setInvalidLinks(newInvalidLinksState)
      setIsValidating(false)
    }

    revalidateFields()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, trackedFields])

  useEffect(() => {
    sdk.window.startAutoResizer()
  }, [sdk.window, invalidLinks])

  const isInvalid = isLoading ||
    invalidLinks.length > 0 ||
    !!entityValidationMsg ||
    customFieldErrors.length > 0

  const validationMessages: string[] = useMemo(() => (
    [
      ...(entityValidationMsg ? [entityValidationMsg] : []),
      ...invalidLinks.map(({ message }) => message),
      ...customFieldErrors
    ]
  ), [invalidLinks, entityValidationMsg, customFieldErrors])

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
          isValidating={isValidating}
          lastSavedAt={lastSavedAt}
          triggerScheduleUpdate={getScheduledActions}
        />
        <IssuesSection validationMessages={validationMessages} />
        <ScheduleSection scheduledActions={scheduledActions} triggerScheduleUpdate={getScheduledActions} />
      </FormControl>
      )
}

export default Sidebar
