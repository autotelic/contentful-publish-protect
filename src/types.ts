import { ScheduledActionProps } from 'contentful-management'

export interface AppDialogueInvocationParams {
  entryId: string
  action?: ScheduledActionProps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface AppInstallationParameters {
  contentTypes: string[]
}
