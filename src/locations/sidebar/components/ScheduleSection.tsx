/** @jsxImportSource @emotion/react */

import React, { useCallback, useMemo } from 'react'

import { SidebarAppSDK } from '@contentful/app-sdk'
import { FormControl, SectionHeading, formatDateAndTime, TextLink } from '@contentful/f36-components'
import tokens from '@contentful/f36-tokens'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'
import { ScheduledActionProps } from 'contentful-management'

import { AppDialogueInvocationParams } from '../../../types'

import ScheduledActionCard from './ScheduledActionCard'

interface Props {
  triggerScheduleUpdate: () => Promise<void>
  scheduledActions: ScheduledActionProps[]
}

const styles = {
  sectionHeading: css({
    margin: `${tokens.spacingL} 0px ${tokens.spacingM}`,
    borderBottom: `1px solid ${tokens.gray400}`,
    color: tokens.gray500
  })
}

const ScheduleSection = ({
  triggerScheduleUpdate,
  scheduledActions
}: Props) => {
  const sdk = useSDK<SidebarAppSDK>()
  const cancelScheduledAction = async (action: ScheduledActionProps) => {
    try {
      const isConfirmed = await sdk.dialogs.openConfirm({
        title: 'Cancel Schedule?',
        cancelLabel: 'Close',
        confirmLabel: 'Cancel the schedule',
        intent: 'negative',
        message: `This Entry is scheduled to publish on ${formatDateAndTime(action.scheduledFor.datetime, 'full')}.
      Are you sure you want to cancel?`
      })
      if (isConfirmed) {
        await sdk.cma.scheduledActions.delete({
          spaceId: sdk.ids.space,
          environmentId: sdk.ids.environmentAlias ?? sdk.ids.environment,
          scheduledActionId: action.sys.id
        })
        sdk.notifier.warning('Scheduled action canceled')
      }
    } catch (error) {
      sdk.notifier.error('Unable to cancel scheduled action')
    } finally {
      await triggerScheduleUpdate()
    }
  }

  const openScheduleDialog = useCallback(async (action: ScheduledActionProps) => {
    const parameters: AppDialogueInvocationParams = {
      action,
      entryId: sdk.ids.entry
    }
    const isScheduled = await sdk.dialogs.openCurrentApp({
      title: 'Edit Schedule',
      allowHeightOverflow: true,
      shouldCloseOnOverlayClick: true,
      shouldCloseOnEscapePress: true,
      width: 'medium',
      parameters
    })
    if (isScheduled) {
      await triggerScheduleUpdate()
    }
  }, [sdk, triggerScheduleUpdate])

  const scheduleListUrl = useMemo(() => (
    (new URL(
      `/spaces/${sdk.ids.space}/jobs`,
      'https://app.contentful.com'
    )).toString()
  ), [sdk.ids.space])

  return (
    <div css={css({ marginTop: tokens.spacingL, paddingBottom: tokens.spacing2Xs })}>
      <SectionHeading css={styles.sectionHeading}>
        Current Schedule
      </SectionHeading>
      {!scheduledActions.length
        ? (
          <FormControl.HelpText css={css({ fontStyle: 'italic', marginBottom: tokens.spacingL })}>
            No actions scheduled
          </FormControl.HelpText>
          )
        : (
          <div css={css({ display: 'flex', flexDirection: 'column', gap: tokens.spacing2Xs, marginBottom: tokens.spacingM })}>
            {scheduledActions.map((action) => (
              <ScheduledActionCard
                key={action.sys.id}
                action={action}
                handleCancel={() => cancelScheduledAction(action)}
                handleEdit={() => openScheduleDialog(action)}
              />
            ))}
          </div>
          )}
      <TextLink
        href={scheduleListUrl}
        rel='noopener noreferrer'
        target='_blank'
      >
        View all scheduled entries
      </TextLink>
    </div>
  )
}

export default ScheduleSection
