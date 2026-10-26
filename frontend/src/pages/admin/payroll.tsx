import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  CheckCircle2,
  Clock,
  HandCoins,
  Wallet,
  XCircle,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, TableSkeleton } from '@/components/ui/empty-state'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { adminApi } from '@/lib/api'
import {
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatNairaFromKobo,
  MONTH_NAMES,
} from '@/lib/format'
import type { AdvanceRequest, AdvanceRequestStatus } from '@/types/domain'

type AdvanceFilter = AdvanceRequestStatus | 'all'
type DecisionStatus = Exclude<AdvanceRequestStatus, 'pending'>

const advanceTone: Record<AdvanceRequestStatus, 'warning' | 'success' | 'danger'> =
  {
    pending: 'warning',
    approved: 'success',
    declined: 'danger',
  }

const TODAY = new Date()

export function AdminPayrollPage() {
  const [year, setYear] = React.useState(TODAY.getFullYear())
  const [month, setMonth] = React.useState(TODAY.getMonth() + 1)
  const [staffProfileID, setStaffProfileID] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [note, setNote] = React.useState('')
  const [advanceFilter, setAdvanceFilter] =
    React.useState<AdvanceFilter>('pending')
  const [decision, setDecision] = React.useState<{
    request: AdvanceRequest
    status: DecisionStatus
  } | null>(null)
  const [decisionNote, setDecisionNote] = React.useState('')
  const queryClient = useQueryClient()

  const staffQuery = useQuery({
    queryKey: ['admin', 'payroll', 'staff'],
    queryFn: () => adminApi.listStaff({ per_page: 200 }),
  })
  const salaryQuery = useQuery({
    queryKey: ['admin', 'payroll', 'salary', year],
    queryFn: () => adminApi.listSalaryPayments({ year }),
  })
  const advanceQuery = useQuery({
    queryKey: ['admin', 'payroll', 'advances', advanceFilter],
    queryFn: () => adminApi.listAdvanceRequests({ status: advanceFilter }),
  })

  const salaryMutation = useMutation({
    mutationFn: adminApi.assignSalary,
    onSuccess: (payment) => {
      toast.success(
        `Salary saved for ${payment.staff_name} · ${formatMonthYear(
          payment.month,
          payment.year,
        )}`,
      )
      setAmount('')
      setNote('')
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payroll', 'salary'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not save the salary',
      )
    },
  })

  const decisionMutation = useMutation({
    mutationFn: (input: {
      id: string
      status: DecisionStatus
      note?: string
    }) => adminApi.decideAdvanceRequest(input.id, input.status, input.note),
    onSuccess: (request) => {
      toast.success(
        `Request ${request.status} for ${request.staff_name}`,
      )
      setDecision(null)
      setDecisionNote('')
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payroll', 'advances'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not update the advance request',
      )
    },
  })

  const staff = staffQuery.data?.items ?? []
  const payments = salaryQuery.data ?? []
  const advances = advanceQuery.data ?? []

  function submitSalary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!staffProfileID) {
      toast.error('Choose a staff member')
      return
    }
    const naira = Number(amount)
    if (!Number.isFinite(naira) || naira <= 0) {
      toast.error('Enter a salary amount greater than zero')
      return
    }
    const amountKobo = Math.round(naira * 100)
    if (amountKobo <= 0) {
      toast.error('Enter a salary amount greater than zero')
      return
    }
    salaryMutation.mutate({
      staff_profile_id: staffProfileID,
      month,
      year,
      amount_kobo: amountKobo,
      note: note.trim() || null,
    })
  }

  function openDecision(request: AdvanceRequest, status: DecisionStatus) {
    setDecision({ request, status })
    setDecisionNote('')
  }

  function submitDecision() {
    if (!decision) return
    decisionMutation.mutate({
      id: decision.request.id,
      status: decision.status,
      note: decisionNote.trim() || undefined,
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Wallet}
        title="Payroll"
        description="Assign monthly salaries and decide staff requests for an upfront payment."
      />

      <Tabs defaultValue="salary">
        <TabsList>
          <TabsTrigger value="salary">Salary payments</TabsTrigger>
          <TabsTrigger value="advances">Upfront requests</TabsTrigger>
        </TabsList>

        <TabsContent value="salary" className="space-y-5 pt-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="size-4 text-ink-400" aria-hidden />
                  Assign salary
                </CardTitle>
                <p className="text-sm text-ink-500">
                  One assignment per staff member, month and year. Saving the
                  same period again updates the amount and re-notifies the
                  staff member.
                </p>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitSalary}>
                  <Field label="Staff member" htmlFor="payroll-staff" required>
                    <Select
                      id="payroll-staff"
                      value={staffProfileID}
                      onChange={(event) => setStaffProfileID(event.target.value)}
                      disabled={staffQuery.isLoading}
                    >
                      <option value="">
                        {staffQuery.isLoading ? 'Loading staff…' : 'Select staff'}
                      </option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.first_name} {member.last_name} · {member.staff_id}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Month" htmlFor="payroll-month" required>
                      <Select
                        id="payroll-month"
                        value={month}
                        onChange={(event) => setMonth(Number(event.target.value))}
                      >
                        {MONTH_NAMES.map((name, index) => (
                          <option key={name} value={index + 1}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Year" htmlFor="payroll-year" required>
                      <Input
                        id="payroll-year"
                        type="number"
                        min={2000}
                        max={2100}
                        value={year}
                        onChange={(event) => setYear(Number(event.target.value))}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Amount (₦)"
                    htmlFor="payroll-amount"
                    hint="Enter naira; the API stores exact kobo."
                    required
                  >
                    <Input
                      id="payroll-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="250000.00"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </Field>

                  <Field label="Note (optional)" htmlFor="payroll-note">
                    <Textarea
                      id="payroll-note"
                      rows={3}
                      maxLength={500}
                      placeholder="Anything the staff member should know about this payment"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </Field>

                  <Button
                    type="submit"
                    className="w-full"
                    loading={salaryMutation.isPending}
                    loadingText="Saving…"
                  >
                    Save salary
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle>Assignments in {year}</CardTitle>
                <Badge variant="neutral">{payments.length} records</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {salaryQuery.isLoading ? (
                  <TableSkeleton rows={5} />
                ) : payments.length === 0 ? (
                  <EmptyState
                    icon={Banknote}
                    title="No salary assignments yet"
                    description="Use the form to assign the first salary for this year."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <p className="font-medium text-ink-900">
                              {payment.staff_name}
                            </p>
                            <p className="text-xs text-ink-500">
                              {payment.staff_id}
                            </p>
                          </TableCell>
                          <TableCell>
                            {formatMonthYear(payment.month, payment.year)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNairaFromKobo(payment.amount_kobo)}
                          </TableCell>
                          <TableCell className="max-w-48 truncate text-ink-500">
                            {payment.note ?? '—'}
                          </TableCell>
                          <TableCell className="text-ink-500">
                            {formatDate(payment.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advances" className="space-y-5 pt-5">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Upfront payment requests</CardTitle>
                <p className="mt-1 text-sm text-ink-500">
                  Approval records a decision only; it does not deduct from a
                  salary assignment.
                </p>
              </div>
              <Select
                aria-label="Filter requests"
                className="w-40"
                value={advanceFilter}
                onChange={(event) =>
                  setAdvanceFilter(event.target.value as AdvanceFilter)
                }
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
                <option value="all">All requests</option>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              {advanceQuery.isLoading ? (
                <TableSkeleton rows={5} />
              ) : advances.length === 0 ? (
                <EmptyState
                  icon={HandCoins}
                  title="No requests here"
                  description={
                    advanceFilter === 'pending'
                      ? 'There are no upfront-payment requests waiting for a decision.'
                      : 'No requests match this filter.'
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decision note</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <p className="font-medium text-ink-900">
                            {request.staff_name}
                          </p>
                          <p className="text-xs text-ink-500">
                            {request.staff_id}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatNairaFromKobo(request.amount_kobo)}
                        </TableCell>
                        <TableCell className="max-w-64 text-ink-600">
                          {request.reason}
                        </TableCell>
                        <TableCell className="text-ink-500">
                          {formatDateTime(request.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={advanceTone[request.status]}
                            dot
                            className="capitalize"
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-48 text-ink-500">
                          {request.decision_note ?? '—'}
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() =>
                                  openDecision(request, 'approved')
                                }
                              >
                                <CheckCircle2 />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger-outline"
                                onClick={() =>
                                  openDecision(request, 'declined')
                                }
                              >
                                <XCircle />
                                Decline
                              </Button>
                            </div>
                          ) : (
                            <p className="flex items-center justify-end gap-1.5 text-xs text-ink-400">
                              <Clock className="size-3.5" />
                              {request.decided_at
                                ? formatDate(request.decided_at)
                                : 'Decided'}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDecision(null)
            setDecisionNote('')
          }
        }}
      >
        <DialogHeader>
          <div>
            <DialogTitle>
              {decision?.status === 'approved'
                ? 'Approve upfront request'
                : 'Decline upfront request'}
            </DialogTitle>
            <DialogDescription>
              {decision
                ? `${decision.request.staff_name} requested ${formatNairaFromKobo(
                    decision.request.amount_kobo,
                  )}.`
                : ''}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {decision && (
            <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3 text-sm text-ink-600">
              <p className="text-2xs font-semibold tracking-wide text-ink-400 uppercase">
                Reason
              </p>
              <p className="mt-1">{decision.request.reason}</p>
            </div>
          )}
          <Field
            label="Note to staff (optional)"
            htmlFor="advance-decision-note"
            hint="This appears in the email sent to the staff member."
          >
            <Textarea
              id="advance-decision-note"
              rows={3}
              maxLength={500}
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              placeholder={
                decision?.status === 'approved'
                  ? 'For example: pay with the next payroll run.'
                  : 'Explain why the request could not be approved.'
              }
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDecision(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={decision?.status === 'declined' ? 'danger' : 'success'}
            loading={decisionMutation.isPending}
            loadingText="Saving…"
            onClick={submitDecision}
          >
            {decision?.status === 'declined' ? 'Decline request' : 'Approve request'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
