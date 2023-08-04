/** @jsxImportSource @emotion/react */

import React from 'react'

import { SidebarAppSDK } from '@contentful/app-sdk'
import {
  Text,
  TextLink,
  Badge,
  Caption
} from '@contentful/f36-components'
import { LockTrimmedIcon } from '@contentful/f36-icons'
import tokens from '@contentful/f36-tokens'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'

const styles = {
  statusRow: css({
    minWidth: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  })
}

const AppDetailsSection = () => {
  const sdk = useSDK<SidebarAppSDK>()
  return (
    <div css={css({ display: 'flex', flexDirection: 'column' })}>
      <div css={styles.statusRow}>
        <Text css={css({ color: tokens.gray600 })}>
          Protection
        </Text>
        <Badge
          css={css({ marginLeft: tokens.spacing2Xs })}
          startIcon={<LockTrimmedIcon />}
          variant='primary'
        >
          Active
        </Badge>
      </div>
      <Caption>
        <TextLink
          as='button'
          variant='muted'
          onClick={() => sdk.navigator.openAppConfig()}
        >
          Settings
        </TextLink>
      </Caption>
    </div>
  )
}

export default AppDetailsSection
