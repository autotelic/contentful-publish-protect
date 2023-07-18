/** @jsxImportSource @emotion/react */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { DialogAppSDK } from '@contentful/app-sdk'
import {
  Autocomplete,
  Button,
  Datepicker,
  FormControl,
  Note,
  Popover,
  Radio,
  SkeletonBodyText,
  SkeletonContainer,
  SkeletonDisplayText,
  TextInput,
  formatDateAndTime,
  formatMachineReadableDateTime
} from '@contentful/f36-components'
import tokens from '@contentful/f36-tokens'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'
import { KeyValueMap } from 'contentful-management'
import { CreateUpdateScheduledActionProps, ScheduledActionProps } from 'contentful-management/dist/typings/entities/scheduled-action'

import { scheduleTimes } from '../components/constants/scheduleTimes'
import { timezones } from '../components/constants/timezones'

export interface DialogueInvocationParams {
  entryId: string
  action?: ScheduledActionProps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type SDK = DialogAppSDK<KeyValueMap, DialogueInvocationParams>

interface ScheduleActionParams {
  action: 'publish' | 'unpublish'
  date: Date
  entryId: string
  environmentId: string
  time: string
  timezone: string
}

const PUBLISH_ACTION = 'publish'
const UNPUBLISH_ACTION = 'unpublish'

const styles = {
  container: css({
    padding: `${tokens.spacingM} ${tokens.spacingL}`,
    height: '428px',
    width: '520px'
  }),
  radio: css({
    alignItems: 'flex-start',
    display: 'flex',
    flexBasis: '100%',
    flexDirection: 'column'
  }),
  inputGroup: css({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingM,
    marginBottom: tokens.spacingXl,
    textTransform: 'capitalize'
  })
}

const isSameDay = (dateA: Date, dateB: Date) => (
  formatMachineReadableDateTime(dateA, 'day') === formatMachineReadableDateTime(dateB, 'day')
)

const getAvailableTimes = (scheduleDate?: Date) => {
  if (!scheduleDate) return scheduleTimes
  const today = new Date()
  if (!isSameDay(today, scheduleDate)) return scheduleTimes
  const [hourMinute, amPm] = formatDateAndTime(today, 'time').split(' ')
  const [hour, minute] = hourMinute.split(':')
  const cappedMinute = parseInt(minute) >= 30 ? '30' : '00'
  const sliceIndex = scheduleTimes.indexOf(`${hour}:${cappedMinute} ${amPm}`) + 1
  return scheduleTimes.slice(sliceIndex)
}

const trimParseLeadingZero = (str: string) => parseInt(str.startsWith('0') ? str.slice(1, 2) : str)

const createScheduleActionProps = ({
  action,
  date,
  entryId,
  environmentId,
  time,
  timezone
}: ScheduleActionParams): CreateUpdateScheduledActionProps => {
  // Clone the date param to prevent mutation
  const datetime = new Date(date.getTime())
  const [hours, minutes] = to24hourFormat(time).split(':').map(trimParseLeadingZero)
  datetime.setHours(hours, minutes)
  return ({
    action,
    entity: {
      sys: {
        type: 'Link',
        linkType: 'Entry',
        id: entryId
      }
    },
    environment: {
      sys: {
        id: environmentId,
        type: 'Link',
        linkType: 'Environment'
      }
    },
    scheduledFor: {
      datetime: datetime.toISOString(),
      timezone
    }
  })
}

// Assuming format is h:mm AM/PM
const to24hourFormat = (t: string) => {
  const [hourMinute, amPm] = t.split(' ')
  const [hour, minutes] = hourMinute.split(':')
  if (amPm === 'AM' && hour === '12') return `00:${minutes}`
  if (amPm === 'PM' && hour !== '12') return `${(parseInt(hour) + 12).toString()}:${minutes}`
  return `${hour}:${minutes}`
}

function Dialogue () {
  const sdk = useSDK<SDK>()
  const [scheduledActionId, setScheduledActionId] = useState<string | undefined>()
  const [scheduleAction, setScheduleAction] = useState<'publish' | 'unpublish'>(PUBLISH_ACTION)
  const [scheduledDay, setScheduledDay] = useState<Date | undefined>(new Date())
  const [scheduledTime, setScheduledTime] = useState<string>(getAvailableTimes(new Date())[1])
  const [isTimeSlotsOpen, setTimeSlotsOpen] = useState<boolean>(false)
  const [isLoading, setLoading] = useState<boolean>(true)
  const [timezone, setTimezone] = useState<string>(timezones[0].value)

  useEffect(() => {
    sdk.window.startAutoResizer()
    if (sdk.parameters.invocation.action?.sys.id) {
      const {
        sys,
        action,
        scheduledFor
      } = sdk.parameters.invocation.action
      setScheduledActionId(sys.id)
      setScheduleAction(action)
      const date = new Date(scheduledFor.datetime)
      setScheduledDay(date)
      setScheduledTime(formatDateAndTime(scheduledFor.datetime, 'time'))
      if (scheduledFor.timezone) setTimezone(scheduledFor.timezone)
    }
    setLoading(false)
  }, [sdk])

  const availableTimes = useMemo(() => getAvailableTimes(scheduledDay), [scheduledDay])

  const isTimeValid = useMemo(() => {
    if (!scheduledDay) return false
    const today = new Date()
    if (!isSameDay(today, scheduledDay)) return true
    const [currentHour, currentMinutes] = to24hourFormat(formatDateAndTime(today, 'time')).split(':').map(trimParseLeadingZero)
    const [scheduledHour, scheduledMinutes] = to24hourFormat(scheduledTime).split(':').map(trimParseLeadingZero)
    return currentHour < scheduledHour ||
      (currentHour === scheduledHour && currentMinutes < scheduledMinutes)
  }, [scheduledDay, scheduledTime])

  const onScheduleAction = useCallback(async () => {
    try {
      const payload = createScheduleActionProps({
        action: scheduleAction,
        date: (scheduledDay as Date),
        entryId: sdk.parameters.invocation.entryId,
        environmentId: sdk.ids.environment,
        time: scheduledTime,
        timezone
      })
      if (scheduledActionId) {
        await sdk.cma.scheduledActions.update({
          spaceId: sdk.ids.space,
          scheduledActionId,
          version: sdk.parameters.invocation.action?.sys.version ?? 1
        }, payload)
        sdk.notifier.success(`Updated scheduled ${scheduleAction} action`)
      } else {
        await sdk.cma.scheduledActions.create({
          spaceId: sdk.ids.space
        }, payload)
        sdk.notifier.success(`Scheduled ${scheduleAction} action created`)
      }
    } catch (error) {
      sdk.notifier.error(`Failed to schedule ${scheduleAction} action`)
    } finally {
      sdk.close(true)
    }
  }, [sdk, scheduleAction, scheduledActionId, scheduledDay, scheduledTime, timezone])

  return (
    isLoading
      ? (
        <SkeletonContainer width='500px'>
          <SkeletonDisplayText offsetLeft={18} offsetTop={8} />
          <SkeletonBodyText numberOfLines={3} offsetLeft={18} offsetTop={45} />
        </SkeletonContainer>
        )
      : (
        <FormControl css={styles.container}>
          <FormControl.Label isRequired>
            Schedule
          </FormControl.Label>
          <Radio.Group css={styles.inputGroup} value={scheduleAction}>
            <Radio
              css={styles.radio}
              value={PUBLISH_ACTION}
              onClick={() => setScheduleAction(PUBLISH_ACTION)}
            >
              {PUBLISH_ACTION}
            </Radio>
            <Radio
              css={styles.radio}
              value={UNPUBLISH_ACTION}
              onClick={() => setScheduleAction(UNPUBLISH_ACTION)}
            >
              {UNPUBLISH_ACTION}
            </Radio>
          </Radio.Group>
          <div css={styles.inputGroup}>
            <div css={css({ display: 'flex', flex: '2 1 0%', flexDirection: 'column' })}>
              <FormControl.Label isRequired>
                <span css={css({ textTransform: 'capitalize' })}>
                  {scheduleAction}
                </span>
                {' '}
                on
              </FormControl.Label>
              <Datepicker
                dateFormat="do LLL yyyy"
                fromDate={new Date()}
                selected={scheduledDay}
                onSelect={setScheduledDay}
              />
            </div>
            <div css={css({ display: 'flex', flex: '1 1 0%', flexDirection: 'column' })}>
              <FormControl.Label>
                Time
              </FormControl.Label>
              <Popover isOpen={isTimeSlotsOpen} isFullWidth onClose={() => setTimeSlotsOpen(false)}>
                <Popover.Trigger>
                  <TextInput
                    css={css({ textAlign: 'center' })}
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    onClick={() => setTimeSlotsOpen(!isTimeSlotsOpen)}
                    onBlur={(e) => {
                      const { value } = e.target
                      const amIndex = value.toUpperCase().indexOf('AM')
                      const pmIndex = value.toUpperCase().indexOf('PM')

                      const [
                        amPm,
                        sliceIndex
                      ] = amIndex >= 0 && (pmIndex < 0 || amIndex < pmIndex)
                        ? ['AM', amIndex]
                        : ['PM', pmIndex]

                      const [maybeHours, maybeMinutes] = value
                        .slice(0, sliceIndex)
                        .trim()
                        .split(':')
                        .map(trimParseLeadingZero)

                      if (
                        isFinite(maybeHours) &&
                        isFinite(maybeMinutes) &&
                        maybeHours <= 12 &&
                        maybeMinutes < 60
                      ) {
                        const hoursStr = maybeHours.toString()
                        const minStr = maybeMinutes < 10
                          ? '0' + maybeMinutes.toString()
                          : maybeMinutes.toString()
                        setScheduledTime(`${hoursStr}:${minStr} ${amPm}`)
                      } else {
                        setScheduledTime(getAvailableTimes(new Date())[1])
                      }
                    }}
                  />
                </Popover.Trigger>
                <Popover.Content css={css({ display: 'flex', flexDirection: 'column', maxHeight: '200px', overflowY: 'scroll' })}>
                  {availableTimes.map((time) => (
                    <Button key={time} css={css({ justifyContent: 'flex-start' })} variant='transparent' isFullWidth onClick={() => setScheduledTime(time)}>
                      {time}
                    </Button>
                  ))}
                </Popover.Content>
              </Popover>
            </div>
          </div>
          <div css={css({ display: 'flex', flexDirection: 'column', marginBottom: tokens.spacingXl })}>
            <FormControl.Label>
              Timezone
            </FormControl.Label>
            <Autocomplete
              items={timezones}
              itemToString={(item) => item.label}
              listWidth='full'
              placeholder={timezones[0].label}
              renderItem={(item) => item.label}
              onSelectItem={(tz) => { setTimezone(tz.value) }}
            />
          </div>
          <div css={css({ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: tokens.spacingM, paddingTop: tokens.spacing2Xl })}>
            <Button onClick={() => sdk.close(false)}>
              Cancel
            </Button>
            <Button
              isDisabled={!isTimeValid}
              variant='primary'
              onClick={() => {
                onScheduleAction()
              }}
            >
              Set Schedule
            </Button>
          </div>
          {!isTimeValid
            ? (
              <Note variant='negative'>
                Selected time can&apos;t be in the past
              </Note>
              )
            : null}
        </FormControl>
        )
  )
}

export default Dialogue
