/** @jsxImportSource @emotion/react */

import React, { useState } from 'react'

import { Card, Popover, IconButton, DateTime, Badge, Button } from '@contentful/f36-components'
import { ClockIcon, MoreVerticalTrimmedIcon } from '@contentful/f36-icons'
import tokens from '@contentful/f36-tokens'
import { css } from '@emotion/react'
import { ScheduledActionProps } from 'contentful-management'

interface Props {
  action: ScheduledActionProps
  handleCancel: () => void
  handleEdit: () => void
}

const styles = {
  container: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingS
  }),
  column: css({
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingXs
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingS
  }),
  actionButton: css({
    minWidth: '150px',
    padding: `${tokens.spacing2Xs} ${tokens.spacingXs}`,
    justifyContent: 'flex-start',
    textAlign: 'left'
  })
}

const ScheduledActionCard = ({ action, handleEdit, handleCancel }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  return (
    <Card>
      <div css={styles.container}>
        <div css={styles.column}>
          <DateTime
            css={css({ fontWeight: tokens.fontWeightDemiBold })}
            date={action.scheduledFor.datetime}
          />
          <div css={styles.row}>
            <Badge
              startIcon={<ClockIcon />}
              variant={action.action === 'unpublish' ? 'secondary' : 'positive'}
            >
              {action.action}
            </Badge>
          </div>
        </div>
        <Popover isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
          <Popover.Trigger>
            <IconButton
              aria-label='action menu'
              css={css({ padding: `${tokens.spacing2Xs} ${tokens.spacingS}` })}
              icon={<MoreVerticalTrimmedIcon css={css({ fill: tokens.gray600 })} />}
              variant='transparent'
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            />
          </Popover.Trigger>
          <Popover.Content>
            <Button
              css={styles.actionButton}
              variant='transparent'
              isFullWidth
              onClick={handleEdit}
            >
              Edit Schedule
            </Button>
            <Button
              css={styles.actionButton}
              variant='transparent'
              isFullWidth
              onClick={handleCancel}
            >
              Cancel action
            </Button>
          </Popover.Content>
        </Popover>
      </div>
    </Card>
  )
}

export default ScheduledActionCard
