/** @jsxImportSource @emotion/react */

import { useEffect, useMemo, useState } from 'react'

import { DialogAppSDK } from '@contentful/app-sdk'
import {
  Autocomplete,
  Button,
  Datepicker,
  FormControl,
  Note,
  Popover,
  Radio,
  TextInput,
  formatDateAndTime,
  formatMachineReadableDateTime
} from '@contentful/f36-components'
import tokens from '@contentful/f36-tokens'
import { useSDK } from '@contentful/react-apps-toolkit'
import { css } from '@emotion/react'
import { ISO8601Timestamp, KeyValueMap } from 'contentful-management'
import { CreateUpdateScheduledActionProps } from 'contentful-management/dist/typings/entities/scheduled-action'

import { scheduleTimes } from '../components/constants/scheduleTimes'
import { timezones } from '../components/constants/timezones'

type SDK = DialogAppSDK<KeyValueMap, Record<'entryId', string>>

interface ScheduleActionParams {
  action?: 'publish' | 'unpublish'
  datetime?: ISO8601Timestamp
  entryId: string
  timezone? :string
}

const PUBLISH_ACTION = 'publish'
const UNPUBLISH_ACTION = 'unpublish'

const styles = {
  container: css({
    padding: `${tokens.spacingM} ${tokens.spacingL}`,
    height: '428px'
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

const createScheduleActionProps = ({
  entryId,
  action = PUBLISH_ACTION,
  datetime,
  timezone
}: ScheduleActionParams): CreateUpdateScheduledActionProps => ({
  action,
  entity: {
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id: entryId
    }
  },
  scheduledFor: {
    datetime: datetime ?? (new Date()).toISOString(),
    timezone
  }
})

function Dialogue () {
  const sdk = useSDK<SDK>()
  const [scheduleAction, setScheduleAction] = useState<string>(PUBLISH_ACTION)
  const [scheduledDay, setScheduledDay] = useState<Date | undefined>(new Date())
  const [scheduledTime, setScheduledTime] = useState<string>(getAvailableTimes(new Date())[1])
  const [isTimeSlotsOpen, setTimeSlotsOpen] = useState<boolean>(false)
  const [scheduleTimezone, setScheduleTimezone] = useState<string>(timezones[0].value)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const [scheduleActionProps] = useState<CreateUpdateScheduledActionProps>(
    createScheduleActionProps({ entryId: sdk.parameters.invocation.entryId })
  )

  useEffect(() => {
    sdk.window.startAutoResizer()
  }, [sdk])

  console.log(scheduleTimezone)

  const availableTimes = useMemo(() => getAvailableTimes(scheduledDay), [scheduledDay])
  const isTimeValid = useMemo(() => {
    if (!scheduledDay) return false
    const today = new Date()
    if (!isSameDay(today, scheduledDay)) return true
    const [currentHourMinute, currentAmPm] = formatDateAndTime(today, 'time').split(' ')
    const [scheduledHourMinute, scheduledAmPm] = scheduledTime.split(' ')
    if (scheduledAmPm === 'AM' && currentAmPm === 'PM') return false
    if (currentAmPm === 'AM' && scheduledAmPm === 'PM') return true

    const [currentHour, currentMinutes] = currentHourMinute.split(':')
    const [scheduledHour, scheduledMinutes] = scheduledHourMinute.split(':')

    // TODO: Deal with leading 0s in minutes
    const currentTimeCompare = currentHour === '12' && currentAmPm === 'AM' ? parseInt(currentMinutes) : parseInt(currentHour) + parseInt(currentMinutes)
    const scheduledTimeCompare = scheduledHour === '12' && scheduledAmPm === 'AM' ? parseInt(scheduledMinutes) : parseInt(scheduledHour) + parseInt(scheduledMinutes)

    return currentTimeCompare > scheduledTimeCompare
  }, [scheduledDay, scheduledTime])

  return (
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
                  const amIndex = e.target.value.toUpperCase().indexOf('AM')
                  const pmIndex = e.target.value.toUpperCase().indexOf('PM')

                  const [
                    amPm,
                    sliceIndex
                  ] = amIndex >= 0 && (pmIndex < 0 || amIndex < pmIndex)
                    ? [' AM', amIndex]
                    : [' PM', pmIndex]

                  const [maybeHours = '', maybeMinutes = ''] = e.target.value.slice(0, sliceIndex).trim().split(':')

                  const maybeHoursParsed = parseInt(maybeHours)
                  const maybeMinutesParsed = parseInt(maybeMinutes[0]) === 0
                    ? parseInt(maybeMinutes[1])
                    : parseInt(maybeMinutes)

                  if (
                    maybeHours.length <= 2 &&
                    maybeMinutes.length === 2 &&
                    isFinite(maybeHoursParsed) &&
                    maybeHoursParsed <= 12 &&
                    isFinite(maybeMinutesParsed) &&
                    maybeMinutesParsed < 60
                  ) {
                    setScheduledTime(`${maybeHours}:${maybeMinutes} ${amPm}`)
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
          onSelectItem={(tz) => { setScheduleTimezone(tz.value) }}
        />
      </div>
      <div css={css({ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: tokens.spacingM, paddingTop: tokens.spacing2Xl })}>
        <Button onClick={sdk.close}>
          Cancel
        </Button>
        <Button isDisabled={!isTimeValid} variant='primary' onClick={sdk.close}>
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
}

export default Dialogue
