/** @jsxImportSource @emotion/react */

import React, { useCallback } from 'react'

import { SidebarAppSDK } from '@contentful/app-sdk'
import {
  EntityStatusBadge,
  FormControl,
  Text,
  SectionHeading,
  RelativeDateTime,
  EntityStatus
} from '@contentful/f36-components'
import tokens from '@contentful/f36-tokens'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'

import PublishButton from './PublishButton'

interface Props {
  entityStatus: EntityStatus
  isActionScheduled: boolean
  isInvalid: boolean
  lastSavedAt?: string
  triggerScheduleUpdate: () => Promise<void>
}

const styles = {
  sectionHeading: css({
    margin: `${tokens.spacingL} 0px ${tokens.spacingM}`,
    borderBottom: `1px solid ${tokens.gray400}`,
    color: tokens.gray500
  }),
  statusRow: css({
    minWidth: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  })
}

const PublishStatusSection = ({
  entityStatus,
  isActionScheduled,
  isInvalid,
  lastSavedAt,
  triggerScheduleUpdate
}: Props) => {
  const sdk = useSDK<SidebarAppSDK>()
  const openScheduleDialog = useCallback(async () => {
    const isScheduled = await sdk.dialogs.openCurrentApp({
      title: 'Set Schedule',
      allowHeightOverflow: true,
      shouldCloseOnOverlayClick: true,
      shouldCloseOnEscapePress: true,
      width: 'medium',
      parameters: { entryId: sdk.ids.entry }
    })
    if (isScheduled) {
      await triggerScheduleUpdate()
    }
  }, [sdk, triggerScheduleUpdate])

  return (
    <div css={css({ marginTop: tokens.spacingL, paddingBottom: tokens.spacing2Xs })}>
      <SectionHeading css={styles.sectionHeading}>
        Status
      </SectionHeading>
      <div css={styles.statusRow}>
        <Text css={css({ color: tokens.gray600 })}>
          Current
        </Text>
        <EntityStatusBadge entityStatus={entityStatus} isScheduled={isActionScheduled} />
      </div>
      <PublishButton
        isDisabled={isInvalid}
        openScheduleDialog={openScheduleDialog}
        sdk={sdk}
        status={entityStatus}
      />
      {lastSavedAt
        ? (
          <FormControl.HelpText css={css({ paddingBottom: tokens.spacing2Xs, color: tokens.gray600 })}>
            Last saved
            {' '}
            <RelativeDateTime date={lastSavedAt} />
          </FormControl.HelpText>
          )
        : null}
    </div>
  )
}

export default PublishStatusSection
