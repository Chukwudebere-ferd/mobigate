import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Fingerprint,
  IdCard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox, Field, Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { fullName } from '@/lib/format'
import { ApiError } from '@/lib/api/client'
import {
  clearKioskToken,
  getKioskToken,
  kioskApi,
  setKioskToken,
} from '@/lib/api'
import type { KioskStaff } from '@/types/domain'

/**
 * The office clocking laptop.
 *
 * This screen is deliberately public: the kiosk is a shared machine, and the
 * person clocking in is identified by their staff number and photograph
 * rather than by a login. What confines clocking to the office is the paired
 * device token, which the server checks on every request. A personal phone
 * or laptop that reaches this page still cannot record attendance — it has
 * no token, so the server refuses it before the photograph is even accepted.
 *
 * The flow is: pair once → type staff ID → confirm the name → look at the
 * camera → snap → done. The staff ID is cleared after every use so the next
 * person cannot clock in on someone else's record by pressing a button.
 */

type Step =
  | { kind: 'pair' }
  | { kind: 'idle' }
  | { kind: 'confirm'; staff: KioskStaff }
  | { kind: 'camera'; staff: KioskStaff }
  | { kind: 'submitting'; staff: KioskStaff }
  | { kind: 'done'; staff: KioskStaff; at: string; action: 'in' | 'out' }
  | { kind: 'error'; staff: KioskStaff; message: string }

const CONSENT_TEXT =
  'I agree that my photograph is captured as evidence of this clock-in or ' +
  'clock-out, and is retained for attendance records. It is visible only to ' +
  'administrators and is deleted after the retention period set in Settings.'

export function KioskPage() {
  const [step, setStep] = React.useState<Step>(() =>
    getKioskToken() ? { kind: 'idle' } : { kind: 'pair' },
  )
  const [staffId, setStaffId] = React.useState('')
  const [consent, setConsent] = React.useState(false)

  // Reset the typed staff ID whenever we return to the idle screen. A shared
  // device must never leave the previous person's number sitting in a field.
  React.useEffect(() => {
    if (step.kind === 'idle') setStaffId('')
  }, [step.kind])

  async function lookup(event: React.FormEvent) {
    event.preventDefault()
    const typed = staffId.trim()
    if (!typed) return
    try {
      const staff = await kioskApi.verifyStaff(typed)
      setStep({ kind: 'confirm', staff })
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        // The pairing is gone or revoked. Send the laptop back to pairing
        // rather than showing a message the office cannot act on.
        clearKioskToken()
        setStep({ kind: 'pair' })
        toast.error('This laptop needs to be paired again.')
        return
      }
      toast.error(
        error instanceof Error
          ? error.message
          : 'That staff ID could not be found.',
      )
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <KioskHeader
        paired={step.kind !== 'pair'}
        onUnpair={() => {
          clearKioskToken()
          setStep({ kind: 'pair' })
        }}
      />

      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg">
          {/* Live clock. Shown for reassurance that the machine is working;
              the authoritative time is recorded by the server, never here. */}
          <LiveClock />

          {step.kind === 'pair' && (
            <PairScreen
              onPaired={() => {
                toast.success('Laptop paired. You can clock in now.')
                setStep({ kind: 'idle' })
              }}
            />
          )}

          {step.kind === 'idle' && (
            <form onSubmit={lookup}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IdCard className="size-4 text-ink-400" aria-hidden />
                    Enter your Staff ID
                  </CardTitle>
                  <CardDescription>
                    Type the Staff ID on your record, then check that your name
                    appears before the camera opens.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field
                    label="Staff ID"
                    htmlFor="kiosk-staff-id"
                    hint="For example STA/LA/2026/0007"
                  >
                    <Input
                      id="kiosk-staff-id"
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      autoFocus
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      inputMode="text"
                      placeholder="STA/LA/2026/0007"
                      className="font-mono text-base uppercase"
                    />
                  </Field>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={false}
                    disabled={!staffId.trim()}
                  >
                    Find my record
                  </Button>
                </CardContent>
              </Card>
            </form>
          )}

          {step.kind === 'confirm' && (
            <ConfirmScreen
              staff={step.staff}
              consent={consent}
              onConsent={setConsent}
              onBack={() => setStep({ kind: 'idle' })}
              onStart={() => setStep({ kind: 'camera', staff: step.staff })}
            />
          )}

          {step.kind === 'camera' && (
            <CaptureScreen
              staff={step.staff}
              action={step.staff.is_clocked_in ? 'out' : 'in'}
              consentGiven={consent}
              onDone={(at, action) =>
                setStep({ kind: 'done', staff: step.staff, at, action })
              }
              onError={(message) =>
                setStep({ kind: 'error', staff: step.staff, message })
              }
            />
          )}

          {step.kind === 'submitting' && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10">
                <RefreshCw className="size-8 animate-spin text-brand-600" aria-hidden />
                <p className="text-sm text-ink-600">Recording…</p>
              </CardContent>
            </Card>
          )}

          {step.kind === 'done' && (
            <DoneScreen
              staff={step.staff}
              at={step.at}
              action={step.action}
              onAgain={() => {
                setConsent(false)
                setStep({ kind: 'idle' })
              }}
            />
          )}

          {step.kind === 'error' && (
            <ErrorScreen
              message={step.message}
              onRetry={() => setStep({ kind: 'confirm', staff: step.staff })}
            />
          )}
        </div>
      </main>
    </div>
  )
}

/* -- Header ---------------------------------------------------------------- */

function KioskHeader({
  paired,
  onUnpair,
}: {
  paired: boolean
  onUnpair: () => void
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          M
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-ink-900">Mobigate Group</p>
          <p className="text-2xs text-ink-500">Attendance terminal</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {paired ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-2xs font-medium text-success-700 ring-1 ring-success-100 sm:inline-flex">
              <ShieldCheck className="size-3.5" aria-hidden />
              Paired
            </span>
          ) : (
            <span className="hidden items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-1 text-2xs font-medium text-warning-700 ring-1 ring-warning-100 sm:inline-flex">
              <AlertCircle className="size-3.5" aria-hidden />
              Not paired
            </span>
          )}
          {paired && (
            <button
              type="button"
              onClick={onUnpair}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Unpair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

/* -- Live clock ------------------------------------------------------------- */

function LiveClock() {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const time = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const date = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mb-6 rounded-xl border border-ink-200 bg-white px-5 py-4 text-center shadow-xs">
      <p className="font-mono text-3xl font-semibold tracking-tight text-ink-950 tabular sm:text-4xl">
        {time}
      </p>
      <p className="mt-1 text-sm text-ink-500">{date}</p>
      <p className="mt-2 text-2xs text-ink-400">
        Attendance is recorded against the office clock, not this screen.
      </p>
    </div>
  )
}

/* -- Pairing ---------------------------------------------------------------- */

function PairScreen({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    try {
      const pairing = await kioskApi.pair(code.trim())
      setKioskToken(pairing.token)
      setCode('')
      onPaired()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'That pairing code was not accepted.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="size-4 text-ink-400" aria-hidden />
            Pair this laptop
          </CardTitle>
          <CardDescription>
            An administrator generates a pairing code from
            <span className="font-medium text-ink-700"> Settings → Attendance</span>.
            Enter it once and this laptop can record attendance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Pairing code"
            htmlFor="kiosk-pair-code"
            hint="Eight characters, shown once in Settings."
          >
            <Input
              id="kiosk-pair-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCD2345"
              className="font-mono text-base tracking-widest uppercase"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={!code.trim()}
          >
            Pair this laptop
          </Button>
          <p className="text-center text-xs text-ink-500">
            Staff should sign in to view their own attendance history.
          </p>
        </CardContent>
      </Card>
    </form>
  )
}

/* -- Identity confirmation -------------------------------------------------- */

function ConfirmScreen({
  staff,
  consent,
  onConsent,
  onBack,
  onStart,
}: {
  staff: KioskStaff
  consent: boolean
  onConsent: (value: boolean) => void
  onBack: () => void
  onStart: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4 text-ink-400" aria-hidden />
          Is this you?
        </CardTitle>
        <CardDescription>
          Check your name before the camera opens. If this is not your record,
          go back and re-enter your Staff ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4 rounded-lg border border-ink-200 bg-ink-50/70 p-4">
          <Avatar initials={initialsOf(staff.first_name, staff.last_name)} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink-900">
              {fullName(staff.first_name, staff.last_name)}
            </p>
            <p className="truncate text-sm text-ink-600">
              {staff.department_name ?? 'No department set'}
              {staff.position ? ` · ${staff.position}` : ''}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-500">{staff.staff_id}</p>
          </div>
        </div>

        {staff.is_clocked_in && (
          <div className="flex items-start gap-2.5 rounded-lg bg-info-50 px-3 py-2.5 ring-1 ring-info-100">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-info-700" aria-hidden />
            <p className="text-sm text-info-800">
              You are already clocked in. This will record your clock-out.
            </p>
          </div>
        )}

        {/* NDPA 2023: biometric-adjacent evidence needs a recorded, explicit
            consent. Required, not optional, and never pre-ticked. */}
        <div className="rounded-lg border border-warning-200 bg-warning-50/60 p-3.5">
          <p className="mb-2.5 text-2xs font-semibold tracking-wide text-warning-800 uppercase">
            Before you continue
          </p>
          <Checkbox
            checked={consent}
            onChange={(e) => onConsent(e.target.checked)}
            label={CONSENT_TEXT}
          />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft aria-hidden />
            Go back
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onStart}
            disabled={!consent}
            className="flex-1"
          >
            <Camera aria-hidden />
            Open camera
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* -- Capture ---------------------------------------------------------------- */

function CaptureScreen({
  staff,
  action,
  consentGiven,
  onDone,
  onError,
}: {
  staff: KioskStaff
  action: 'in' | 'out'
  consentGiven: boolean
  onDone: (at: string, action: 'in' | 'out') => void
  onError: (message: string) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [ready, setReady] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [facing, setFacing] = React.useState<'user' | 'environment'>('user')

  // Start the camera on mount and whenever the facing direction changes.
  React.useEffect(() => {
    let cancelled = false

    async function start() {
      // Stop whatever was running before requesting a new stream, so flipping
      // the camera does not leave two live streams fighting over the light.
      stopStream(streamRef.current)
      streamRef.current = null
      setReady(false)

      if (!navigator.mediaDevices?.getUserMedia) {
        onError('This browser cannot open a camera. Use a current browser.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 } },
          audio: false,
        })
        if (cancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
          setReady(true)
        }
      } catch {
        onError(
          'The camera could not be opened. Check that no other app is using ' +
            'it, and allow camera access when your browser asks.',
        )
      }
    }

    void start()
    return () => {
      cancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [facing, onError])

  async function snap() {
    const video = videoRef.current
    if (!video || !ready) return
    setBusy(true)
    try {
      const blob = await captureFrame(video, facing)
      const record = action === 'in'
        ? await kioskApi.clockIn({
            staff_profile_id: staff.staff_profile_id,
            photo: blob,
            consent: consentGiven,
          })
        : await kioskApi.clockOut({
            staff_profile_id: staff.staff_profile_id,
            photo: blob,
          })
      const at = record.clock_in_at
      onDone(action === 'in' ? at : (record.clock_out_at ?? at), action)
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        clearKioskToken()
        onError('This laptop is no longer authorised. Pair it again in Settings.')
        return
      }
      onError(
        error instanceof Error ? error.message : 'The attendance could not be saved.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="size-4 text-ink-400" aria-hidden />
          {action === 'in' ? 'Clock in' : 'Clock out'}
        </CardTitle>
        <CardDescription>
          {fullName(staff.first_name, staff.last_name)} — look at the camera and
          hold still, then take the picture.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-950">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={cn(
              'aspect-[4/3] w-full object-cover',
              // Mirror only the front-facing view, so the preview behaves
              // like a mirror. The saved photograph is unmirrored.
              facing === 'user' && 'scale-x-[-1]',
            )}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-ink-300">Starting the camera…</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/30" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
        >
          <RefreshCw aria-hidden />
          Switch camera
        </Button>

        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => void snap()}
          loading={busy}
          loadingText="Saving…"
          disabled={!ready}
        >
          <Camera aria-hidden />
          Take picture and {action}
        </Button>

        <p className="text-center text-2xs text-ink-500">
          Your photograph is kept as evidence of this {action} and is visible
          only to administrators.
        </p>
      </CardContent>
    </Card>
  )
}

/* -- Results ---------------------------------------------------------------- */

function DoneScreen({
  staff,
  at,
  action,
  onAgain,
}: {
  staff: KioskStaff
  at: string
  action: 'in' | 'out'
  onAgain: () => void
}) {
  return (
    <Card className="border-success-100">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-50 ring-1 ring-success-100">
          <CheckCircle2 className="size-9 text-success-700" aria-hidden />
        </span>
        <div>
          <p className="text-xl font-semibold text-ink-900">
            {action === 'in' ? 'Clocked in' : 'Clocked out'}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {fullName(staff.first_name, staff.last_name)} · {staff.staff_id}
          </p>
          <p className="mt-3 font-mono text-2xl font-semibold text-ink-950 tabular">
            {formatClock(at)}
          </p>
          <p className="mt-1 text-sm text-ink-500">{formatDay(at)}</p>
        </div>
        <Button type="button" variant="primary" size="lg" onClick={onAgain}>
          Done — next person
        </Button>
      </CardContent>
    </Card>
  )
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card className="border-danger-100">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-danger-50 ring-1 ring-danger-100">
          <AlertCircle className="size-9 text-danger-700" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold text-ink-900">Not saved</p>
          <p className="mt-1 max-w-sm text-sm text-ink-600">{message}</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => window.location.reload()}
          >
            Start over
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* -- Helpers ---------------------------------------------------------------- */

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700 ring-1 ring-brand-100">
      {initials}
    </span>
  )
}

function initialsOf(first?: string, last?: string) {
  const a = first?.trim()?.[0] ?? ''
  const b = last?.trim()?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

/**
 * Draw the live video frame onto a canvas and export it as a JPEG.
 *
 * The canvas route (rather than grabbing a frame directly) is what lets the
 * kiosk control the exact encoded bytes sent to the server: a JPEG under the
 * 2 MB limit, at a resolution large enough to be useful as evidence.
 */
function captureFrame(
  video: HTMLVideoElement,
  facing: 'user' | 'environment',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      reject(new Error('The camera was not ready. Try again in a moment.'))
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('This browser cannot process the photograph.'))
      return
    }

    if (facing === 'user') {
      // Flip back so the stored photograph reads correctly, not mirrored.
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('The photograph could not be prepared.'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.9,
    )
  })
}

function formatClock(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
