/** @jsxImportSource @emotion/react */

import React, { useState } from 'react'

import { SidebarAppSDK } from '@contentful/app-sdk'
import { Button, Caption, EntityStatus, IconButton, Popover } from '@contentful/f36-components'
import { ChevronDownIcon, ClockIcon } from '@contentful/f36-icons'
import tokens from '@contentful/f36-tokens'
import { css } from '@emotion/react'

interface Props {
  isDisabled: boolean
  status: EntityStatus
  sdk: SidebarAppSDK
  openScheduleDialog: () => Promise<void>
}

const styles = {
  container: css({
    marginBottom: tokens.spacingS,
    width: '327px',
    height: '40px',
    display: 'flex',
    borderRadius: tokens.borderRadiusMedium,
    alignItems: 'center',
    justifyContent: 'center',
    '.popover': {
      borderRadius: tokens.borderRadiusMedium
    }
  }),
  publishButton: css({
    minWidth: '100%',
    borderRadius: `${tokens.borderRadiusMedium} 0px 0px ${tokens.borderRadiusMedium}`
  }),
  popoverTriggerButton: css({
    width: '51px',
    height: '40px',
    borderRadius: `0px ${tokens.borderRadiusMedium} ${tokens.borderRadiusMedium} 0px`
  }),
  popoverButtons: css({
    minWidth: '150px',
    padding: `${tokens.spacing2Xs} ${tokens.spacingXs}`,
    justifyContent: 'flex-start',
    textAlign: 'left'
  }),
  popoverCaption: css({
    color: tokens.gray500,
    padding: `${tokens.spacingXs} ${tokens.spacingS} ${tokens.spacing2Xs}`
  })
}

const PUBLISHED_STATUSES = ['published', 'changed']

const defaultPublishText = 'Publish'
const publishButtonText: Record<EntityStatus, string> = {
  draft: defaultPublishText,
  changed: 'Publish Changes',
  published: 'Change Status',
  new: defaultPublishText,
  deleted: defaultPublishText,
  archived: 'Unarchive'
}

function PublishButton ({
  isDisabled,
  status,
  sdk,
  openScheduleDialog
}: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const handlePublish = async () => {
    try {
      if (status === 'archived') {
        await sdk.cma.entry.unarchive({ entryId: sdk.ids.entry })
        sdk.notifier.success('Entry unarchived')
      } else {
        await sdk.entry.publish({ skipUiValidation: false })
        sdk.notifier.success('Entry published')
      }
    } catch (error) {
      sdk.notifier.error((error as Error).message)
    }
  }

  const createEntryUrl = (entryId: string) => (
    new URL(
      `/spaces/${sdk.ids.space}/environments/${sdk.ids.environment}/entries/${entryId}`,
      'https://app.contentful.com'
    ).toString()
  )

  const handleUnpublish = async () => {
    try {
      if (status === 'archived') {
        await sdk.entry.publish({ skipUiValidation: false })
        sdk.notifier.success('Entry published')
      } else {
        const linksToEntry = await sdk.cma.entry.getMany({
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environment,
          query: { links_to_entry: sdk.ids.entry }
        })

        if (linksToEntry.total > 0) {
          const linkUrls = linksToEntry.items.map((link) => createEntryUrl(link.sys.id))
          await sdk.dialogs.openAlert({
            title: 'Unable to unpublish entry',
            message: `This entry must have all references to it removed from the following entries:\n${linkUrls.join('\n')}`,
            confirmLabel: 'Close'
          })
        } else {
          await sdk.entry.unpublish()
          sdk.notifier.warning('Entry unpublished')
        }
      }
    } catch (error) {
      sdk.notifier.error((error as Error).message)
    }
  }

  const handleArchive = async () => {
    try {
      const linksToEntry = await sdk.cma.entry.getMany({
        spaceId: sdk.ids.space,
        environmentId: sdk.ids.environment,
        query: { links_to_entry: sdk.ids.entry }
      })

      if (linksToEntry.total > 0) {
        const linkUrls = linksToEntry.items.map((link) => createEntryUrl(link.sys.id))
        await sdk.dialogs.openAlert({
          title: 'Unable to archive entry',
          message: `This entry must have all references to it removed from the following entries:\n${linkUrls.join('\n')}`,
          confirmLabel: 'Close'
        })
      } else {
        const shouldArchive = await sdk.dialogs.openConfirm({
          confirmLabel: 'Yes, archive entry',
          title: 'Are you sure?',
          message: 'This will impact any entries referencing this one',
          intent: 'negative'
        })
        if (shouldArchive) {
          // The default publish button does this too...
          if (PUBLISHED_STATUSES.includes(status)) {
            await sdk.entry.unpublish()
          }
          await sdk.cma.entry.archive({ entryId: sdk.ids.entry })
          sdk.notifier.success('Entry archived')
        }
      }
    } catch (error) {
      sdk.notifier.error((error as Error).message)
    }
  }

  return (
    <div css={styles.container}>
      <div css={css({ width: '100%' })}>
        <Button
          className={status === 'published' ? 'popover' : ''}
          css={styles.publishButton}
          endIcon={status === 'published' ? <ChevronDownIcon /> : undefined}
          isDisabled={['published', 'archived'].includes(status) ? false : isDisabled}
          variant='positive'
          onClick={status === 'published' ? () => setIsOpen(!isOpen) : handlePublish}
        >
          {publishButtonText[status]}
        </Button>

      </div>
      <Popover isOpen={isOpen} onClose={() => setIsOpen(false)}>
        {
          status === 'published'
            ? null
            : (
              <Popover.Trigger>
                <IconButton
                  aria-label='more options'
                  css={styles.popoverTriggerButton}
                  icon={<ChevronDownIcon />}
                  variant='positive'
                  onClick={() => setIsOpen(!isOpen)}
                />
              </Popover.Trigger>
              )
        }
        <Popover.Content>
          <div css={css({ padding: `${tokens.spacing2Xs}` })}>
            <Caption as='p' css={styles.popoverCaption}>
              Change status to
            </Caption>
            {[...PUBLISHED_STATUSES, 'archived'].includes(status)
              ? (
                <Button
                  css={styles.popoverButtons}
                  isDisabled={status === 'archived' ? isDisabled : false}
                  variant='transparent'
                  isFullWidth
                  onClick={handleUnpublish}
                >
                  {status === 'archived' ? 'Publish' : 'Unpublish'}
                </Button>
                )
              : null}
            {status !== 'archived'
              ? (
                <>
                  <Button
                    css={styles.popoverButtons}
                    variant='transparent'
                    isFullWidth
                    onClick={handleArchive}
                  >
                    Archive
                  </Button>
                  <Button
                    css={styles.popoverButtons}
                    isDisabled={isDisabled}
                    startIcon={<ClockIcon variant='muted' />}
                    variant='transparent'
                    isFullWidth
                    onClick={openScheduleDialog}
                  >
                    Set Schedule
                  </Button>
                </>
                )
              : null}
          </div>
        </Popover.Content>
      </Popover>
    </div>
  )
}

export default PublishButton
