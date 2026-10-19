import { Badge, type BadgeProps } from './badge'
import type {
  AccessCodeStatus,
  ApplicationStatus,
  EmploymentCategory,
  JobStatus,
  StaffStatus,
  UserStatus,
} from '@/types/domain'

type Tone = NonNullable<BadgeProps['variant']>

const applicationTone: Record<ApplicationStatus, Tone> = {
  pending: 'warning',
  shortlisted: 'info',
  rejected: 'danger',
  appointed: 'success',
  withdrawn: 'neutral',
}

const jobTone: Record<JobStatus, Tone> = {
  draft: 'neutral',
  published: 'success',
  closed: 'warning',
  archived: 'neutral',
}

const accessCodeTone: Record<AccessCodeStatus, Tone> = {
  active: 'success',
  used: 'neutral',
  revoked: 'danger',
  expired: 'warning',
}

const staffTone: Record<StaffStatus, Tone> = {
  active: 'success',
  suspended: 'warning',
  exited: 'neutral',
}

const userTone: Record<UserStatus, Tone> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  disabled: 'neutral',
}

const categoryTone: Record<EmploymentCategory, Tone> = {
  director: 'accent',
  employee: 'brand',
  contractor: 'outline',
  partner: 'info',
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge variant={applicationTone[status]} dot>
      {capitalize(status)}
    </Badge>
  )
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge variant={jobTone[status]} dot>
      {capitalize(status)}
    </Badge>
  )
}

export function AccessCodeStatusBadge({ status }: { status: AccessCodeStatus }) {
  return (
    <Badge variant={accessCodeTone[status]} dot>
      {capitalize(status)}
    </Badge>
  )
}

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  return (
    <Badge variant={staffTone[status]} dot>
      {capitalize(status)}
    </Badge>
  )
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge variant={userTone[status]} dot>
      {capitalize(status)}
    </Badge>
  )
}

export function EmploymentCategoryBadge({
  category,
}: {
  category: EmploymentCategory
}) {
  return <Badge variant={categoryTone[category]}>{capitalize(category)}</Badge>
}
