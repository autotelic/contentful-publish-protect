/** @jsxImportSource @emotion/react */

import React from 'react'

import { FormControl, SectionHeading } from '@contentful/f36-components'
import tokens from '@contentful/f36-tokens'
import { css } from '@emotion/react'

interface Props {
  validationMessages: string[]
}

const styles = {
  sectionHeading: css({
    margin: `${tokens.spacingL} 0px ${tokens.spacingM}`,
    borderBottom: `1px solid ${tokens.gray400}`,
    color: tokens.gray500
  })
}

const IssuesSection = ({ validationMessages }: Props) => (
  <div css={css({ marginTop: tokens.spacingL, paddingBottom: tokens.spacing2Xs })}>
    <SectionHeading css={styles.sectionHeading}>
      Issues
    </SectionHeading>
    {validationMessages.map((message, index) => (
      <FormControl.ValidationMessage key={index}>
        {message}
      </FormControl.ValidationMessage>
    ))}
    {!validationMessages.length
      ? (
        <FormControl.HelpText css={css({ fontStyle: 'italic' })}>
          No issues found
        </FormControl.HelpText>
        )
      : (
        <FormControl.HelpText css={css({ fontStyle: 'italic', marginTop: tokens.spacingL })}>
          All issues must be resolved before publishing
        </FormControl.HelpText>
        )}
  </div>
)

export default IssuesSection
