import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Clock, HandCoins } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/empty-state'
import { Field, Input, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { staffApi } from '@/lib/api'
import {
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatNairaFromKobo,
} from '@/lib/format'
import type { AdvanceRequestStatus } from '@/types/domain'

const advanceTone: Record<
  AdvanceRequestStatus,
  'warning' | 'success' | 'danger'
> = {
  pending: 'warning',
  approved: 'success',
  declined: 'danger',
}

/**
 * Staff payroll workspace: salary assignments and upfront-payment requests.
 * The API scopes every read to the signed-in staff member.
 */
export function StaffPayrollPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Banknote}
        title="Payroll"
        description="Your salary assignments and upfront payment requests."
      />
      <StaffPayrollSection />
    </div>
  )
}

function StaffPayrollSection() {
  const queryClient = useQueryClient()
  const payrollQuery = useQuery({
    queryKey: ['staff', 'payroll'],
    queryFn: () => staffApi.payroll(),
    retry: false,
  })
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const requestMutation = useMutation({
    mutationFn: staffApi.requestAdvance,
    onSuccess: () => {
      toast.success('Advance request submitted for review')
      setAmount('')
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['staff', 'payroll'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not submit your advance request',
      )
    },
  })

  const salaries = payrollQuery.data?.salary_payments ?? []
  const advances = payrollQuery.data?.advance_requests ?? []

  function submitAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const naira = Number(amount)
    if (!Number.isFinite(naira) || naira <= 0) {
      toast.error('Enter an amount greater than zero')
      return
    }
    if (!reason.trim()) {
      toast.error('Explain why you need the advance')
      return
    }
    requestMutation.mutate({
      amount_kobo: Math.round(naira * 100),
      reason: reason.trim(),
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="size-4 text-ink-400" aria-hidden />
            Salary assignments
          </CardTitle>
          <CardDescription>
            Salaries set for you by Human Resources.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {payrollQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : salaries.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-500">
              No salary has been assigned yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaries.map((salary) => (
                  <TableRow key={salary.id}>
                    <TableCell className="font-medium">
                      {formatMonthYear(salary.month, salary.year)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatNairaFromKobo(salary.amount_kobo)}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-ink-500">
                      {salary.note ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="size-4 text-ink-400" aria-hidden />
            Request upfront payment
          </CardTitle>
          <CardDescription>
            Ask for part of your salary before the normal pay date. HR reviews
            every request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submitAdvance}>
            <Field
              label="Amount (₦)"
              htmlFor="advance-amount"
              hint="Enter the naira amount you need."
              required
            >
              <Input
                id="advance-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="50000.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field
              label="Reason"
              htmlFor="advance-reason"
              hint="Tell HR why the advance is needed."
              required
            >
              <Textarea
                id="advance-reason"
                rows={3}
                maxLength={500}
                placeholder="For example: school fees due this week."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              className="w-full"
              loading={requestMutation.isPending}
              loadingText="Sending…"
            >
              Send request
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-ink-400" aria-hidden />
            Advance request status
          </CardTitle>
          <CardDescription>
            Every request you have submitted and HR&apos;s decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {payrollQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : advances.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-500">
              You have not requested an advance yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>HR note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell className="text-ink-500">
                      {formatDateTime(advance.created_at)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatNairaFromKobo(advance.amount_kobo)}
                    </TableCell>
                    <TableCell className="max-w-64 text-ink-600">
                      {advance.reason}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={advanceTone[advance.status]}
                        dot
                        className="capitalize"
                      >
                        {advance.status}
                      </Badge>
                      {advance.decided_at && (
                        <p className="mt-1 text-2xs text-ink-400">
                          {formatDate(advance.decided_at)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 text-ink-500">
                      {advance.decision_note ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
