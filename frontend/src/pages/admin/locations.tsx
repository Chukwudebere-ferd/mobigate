/**
 * Admin › Location management (README M1).
 *
 * The location tree is Country → State → LGA → City/Town. Cities and towns
 * sit inside an LGA, so a state must live under a country, an LGA under a
 * state, and a city or town under an LGA (README §4.1).
 *
 * Locations created by an Admin enter `pending` and need Super Admin
 * approval before they can be used on a job or an application.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building,
  Check,
  ChevronRight,
  Flag,
  Globe,
  MapPin,
  Plus,
  ShieldAlert,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { adminApi, locationPath } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useSession } from '@/providers/session-provider'
import type { Location, LocationType } from '@/types/domain'

const locationTypeLabels: Record<LocationType, string> = {
  country: 'Country',
  state: 'State',
  lga: 'LGA',
  city: 'City',
  town: 'Town',
}

const locationTypeIcons: Record<LocationType, typeof Globe> = {
  country: Globe,
  state: Flag,
  lga: Building,
  city: MapPin,
  town: MapPin,
}

/**
 * The location tree is a strict chain: a state must sit under a country, an
 * LGA under a state, and a city or town under an LGA.
 */
const allowedChildTypes: Record<LocationType, LocationType[]> = {
  country: ['state'],
  state: ['lga'],
  lga: ['city', 'town'],
  city: [],
  town: [],
}

const locationStatusTone: Record<
  Location['status'],
  'success' | 'warning' | 'neutral'
> = {
  approved: 'success',
  pending: 'warning',
  inactive: 'neutral',
}

/** Renders the icon that represents a location type. */
function LocationTypeIcon({
  type,
  className,
}: {
  type: LocationType
  className?: string
}) {
  const Icon = locationTypeIcons[type]
  return <Icon className={className} aria-hidden />
}

/** "a state cannot sit directly under an LGA" style explanations. */
function parentageError(
  type: LocationType,
  parentType: LocationType | null,
): string | null {
  if (parentType === null) {
    return type === 'country'
      ? null
      : `A ${locationTypeLabels[type].toLowerCase()} must sit under a country. Add the country first, then work down the hierarchy.`
  }
  const allowed = allowedChildTypes[parentType]
  if (allowed.includes(type)) return null
  if (allowed.length === 0) {
    return `A ${locationTypeLabels[parentType].toLowerCase()} cannot have ${locationTypeLabels[type].toLowerCase()} locations beneath it.`
  }
  return `A ${locationTypeLabels[type].toLowerCase()} cannot sit directly under a ${locationTypeLabels[parentType].toLowerCase()}. It must sit under ${allowed
    .map((t) => locationTypeLabels[t].toLowerCase())
    .join(' or ')}.`
}

export function AdminLocationsPage() {
  const queryClient = useQueryClient()
  const { role } = useSession()
  const isSuperAdmin = role === 'super_admin'
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  // `null` means "use the default expansion"; a Set means the user has
  // explicitly opened or closed nodes.
  const [expandedOverride, setExpandedOverride] = React.useState<
    Set<string> | null
  >(null)
  // `null` = dialog closed, 'root' = add a country, otherwise the id of the
  // parent the new location will sit under.
  const [addParentId, setAddParentId] = React.useState<string | 'root' | null>(
    null,
  )

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: () => adminApi.listLocations(),
  })

  const locations = React.useMemo(
    () => locationsQuery.data ?? [],
    [locationsQuery.data],
  )

  const childrenMap = React.useMemo(() => {
    const map = new Map<string | null, Location[]>()
    for (const location of locations) {
      const bucket = map.get(location.parent_id) ?? []
      bucket.push(location)
      map.set(location.parent_id, bucket)
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name))
    }
    return map
  }, [locations])

  const depthOf = React.useCallback(
    (id: string): number => {
      let depth = 0
      let current = locations.find((l) => l.id === id)
      while (current?.parent_id) {
        depth += 1
        current = locations.find((l) => l.id === current?.parent_id)
        if (depth > 20) break
      }
      return depth
    },
    [locations],
  )

  // Default the tree open to two levels (countries and their states).
  const defaultExpanded = React.useMemo(() => {
    const next = new Set<string>()
    for (const location of locations) {
      if (depthOf(location.id) < 2) next.add(location.id)
    }
    return next
  }, [locations, depthOf])

  const expanded = expandedOverride ?? defaultExpanded

  const pending = React.useMemo(
    () => locations.filter((l) => l.status === 'pending'),
    [locations],
  )

  const roots = childrenMap.get(null) ?? []

  const selected = locations.find((l) => l.id === selectedId) ?? null
  const selectedChildren = selected
    ? (childrenMap.get(selected.id) ?? [])
    : []

  const manageableChildTypes = React.useCallback(
    (type: LocationType) =>
      allowedChildTypes[type].filter(
        (child) =>
          isSuperAdmin || (child !== 'country' && child !== 'state'),
      ),
    [isSuperAdmin],
  )
  const selectedChildTypes = selected
    ? manageableChildTypes(selected.type)
    : []

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveLocation(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<Location[]>(['locations'], (old) =>
        (old ?? []).map((l) => (l.id === updated.id ? updated : l)),
      )
      void queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast.success(`${updated.name} approved.`)
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not approve the location.',
      )
    },
  })

  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedOverride(next)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Location management"
        description="The location tree runs Country → State → LGA → City/Town. Cities and towns sit inside an LGA, so a state belongs to a country, an LGA belongs to a state, and a city or town belongs to an LGA."
        icon={MapPin}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* -- Tree browser -- */}
        <div className="space-y-4">
          <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">
                  Location tree
                </h2>
                <p className="text-xs text-ink-500">
                  {locations.length} locations · {pending.length} awaiting
                  approval
                </p>
              </div>
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddParentId('root')}
                >
                  <Plus />
                  Add country
                </Button>
              )}
            </div>

            <div className="p-2">
              {locationsQuery.isLoading ? (
                <p className="px-3 py-8 text-center text-sm text-ink-500">
                  Loading locations…
                </p>
              ) : locations.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No locations yet"
                  description="Create the country first, then work down the hierarchy: state, LGA, city or town."
                />
              ) : (
                roots.map((root) => (
                  <TreeNode
                    key={root.id}
                    node={root}
                    depth={0}
                    childrenMap={childrenMap}
                    expanded={expanded}
                    onToggle={toggle}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ))
              )}
            </div>
          </div>

          {/* -- Pending approval -- */}
          <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
            <div className="border-b border-ink-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">
                Pending approval
              </h2>
              <p className="text-xs text-ink-500">
                {isSuperAdmin
                  ? 'Locations created by an Admin stay pending until a Super Admin approves them.'
                  : 'Your proposed locations stay pending until a Super Admin approves them.'}
              </p>
            </div>
            {pending.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">
                Nothing is waiting for approval.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {pending.map((location) => {
                  const Icon = locationTypeIcons[location.type]
                  return (
                    <li
                      key={location.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ink-100">
                        <Icon className="size-4 text-ink-500" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">
                          {location.name}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {locationTypeLabels[location.type]} ·{' '}
                          {locationPath(location.id)}
                        </p>
                      </div>
                      <Badge variant="warning" dot>
                        Pending
                      </Badge>
                      {isSuperAdmin && (
                        <Button
                          size="sm"
                          variant="success"
                          loading={
                            approveMutation.isPending &&
                            approveMutation.variables === location.id
                          }
                          onClick={() => approveMutation.mutate(location.id)}
                        >
                          <Check />
                          Approve
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* -- Detail panel -- */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
            <div className="border-b border-ink-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">
                Location detail
              </h2>
            </div>

            {locationsQuery.isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">
                Loading…
              </p>
            ) : !selected ? (
              <EmptyState
                icon={MapPin}
                title="Select a location"
                description="Pick a node in the tree to see its detail, path and children."
              />
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-50 ring-1 ring-brand-100">
                      <LocationTypeIcon
                        type={selected.type}
                        className="size-4.5 text-brand-700"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {selected.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {locationTypeLabels[selected.type]}
                      </p>
                    </div>
                  </div>
                </div>

                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                      Full path
                    </dt>
                    <dd className="mt-0.5 text-ink-800">
                      {locationPath(selected.id)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                      Code
                    </dt>
                    <dd className="mt-0.5">
                      {selected.code ? (
                        <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-800">
                          {selected.code.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                      <p className="mt-1 text-xs text-ink-500">
                        The short code used in ID sequences, e.g. STA/LA/2026/0001.
                      </p>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                      Status
                    </dt>
                    <dd className="mt-0.5">
                      <Badge
                        variant={locationStatusTone[selected.status]}
                        dot
                      >
                        {selected.status === 'approved'
                          ? 'Approved'
                          : selected.status === 'pending'
                            ? 'Pending approval'
                            : 'Inactive'}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                      Created
                    </dt>
                    <dd className="mt-0.5 text-ink-800">
                      {formatDate(selected.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                      Children
                    </dt>
                    <dd className="mt-0.5 text-ink-800">
                      {selectedChildren.length === 0
                        ? 'None yet'
                        : `${selectedChildren.length} direct ${
                            selectedChildren.length === 1 ? 'child' : 'children'
                          }`}
                    </dd>
                  </div>
                </dl>

                {selectedChildren.length > 0 && (
                  <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
                    <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                      Direct children
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {selectedChildren.map((child) => {
                        const ChildIcon = locationTypeIcons[child.type]
                        return (
                          <li key={child.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(child.id)}
                              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm text-ink-700 transition-colors hover:bg-white"
                            >
                              <ChildIcon
                                className="size-3.5 shrink-0 text-ink-400"
                                aria-hidden
                              />
                              <span className="truncate">{child.name}</span>
                              <span className="ml-auto text-2xs text-ink-400">
                                {locationTypeLabels[child.type]}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {selectedChildTypes.length > 0 ? (
                  <Button
                    className="w-full"
                    onClick={() => setAddParentId(selected.id)}
                  >
                    <Plus />
                    Add child location
                  </Button>
                ) : (
                  <p className="text-xs text-ink-500">
                    {allowedChildTypes[selected.type].length === 0
                      ? `A ${locationTypeLabels[selected.type].toLowerCase()} is the last level of the hierarchy.`
                      : 'Only a Super Admin can add a state under a country.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {addParentId !== null && (
        <AddLocationDialog
          key={addParentId}
          parent={
            addParentId === 'root'
              ? null
              : (locations.find((l) => l.id === addParentId) ?? null)
          }
          canCreateTopLevel={isSuperAdmin}
          onOpenChange={(open) => {
            if (!open) setAddParentId(null)
          }}
        />
      )}
    </div>
  )
}

/* -- Tree node ---------------------------------------------------------- */

function TreeNode({
  node,
  depth,
  childrenMap,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: Location
  depth: number
  childrenMap: Map<string | null, Location[]>
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const children = childrenMap.get(node.id) ?? []
  const isOpen = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const Icon = locationTypeIcons[node.type]

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-md pr-2 transition-colors',
          isSelected ? 'bg-brand-50' : 'hover:bg-ink-50',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded text-ink-400 transition-colors hover:bg-ink-200 hover:text-ink-700"
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={isOpen}
          >
            <ChevronRight
              className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')}
              aria-hidden
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 text-left',
            isSelected ? 'text-brand-800' : 'text-ink-800',
          )}
          aria-current={isSelected ? 'true' : undefined}
        >
          <Icon
            className={cn(
              'size-4 shrink-0',
              isSelected ? 'text-brand-600' : 'text-ink-400',
            )}
            aria-hidden
          />
          <span className="truncate text-sm font-medium">{node.name}</span>
          <span className="shrink-0 text-2xs text-ink-400">
            {children.length} {children.length === 1 ? 'child' : 'children'}
          </span>
          {node.status === 'pending' && (
            <Badge variant="warning" dot>
              Pending
            </Badge>
          )}
        </button>
      </div>

      {isOpen &&
        children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            childrenMap={childrenMap}
            expanded={expanded}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}

/* -- Add location ------------------------------------------------------- */

function AddLocationDialog({
  parent,
  canCreateTopLevel,
  onOpenChange,
}: {
  parent: Location | null
  canCreateTopLevel: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const availableTypes = (
    parent ? allowedChildTypes[parent.type] : (['country'] as LocationType[])
  ).filter(
    (child) =>
      canCreateTopLevel || (child !== 'country' && child !== 'state'),
  )
  // The dialog is mounted fresh each time it opens, so the default type is
  // derived from the selected parent without an effect.
  const [type, setType] = React.useState<LocationType>(
    () => availableTypes[0] ?? 'country',
  )
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [touched, setTouched] = React.useState(false)

  const parentType = parent?.type ?? null
  const typeError = parentageError(type, parentType)
  const nameError =
    touched && name.trim().length === 0 ? 'Enter a location name.' : null

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createLocation({
        type,
        name: name.trim(),
        parent_id: parent?.id ?? null,
        code: code.trim() ? code.trim().toUpperCase() : undefined,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<Location[]>(['locations'], (old) => [
        ...(old ?? []).filter((l) => l.id !== created.id),
        created,
      ])
      void queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast.success(
        `${created.name} created. It is pending until a Super Admin approves it.`,
      )
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not create the location.',
      )
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(true)
    if (name.trim().length === 0 || typeError) return
    createMutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>
            {parent ? `Add a child location` : 'Add a country'}
          </DialogTitle>
          <DialogDescription>
            {parent
              ? `This location will sit under ${parent.name}.`
              : 'This location will sit at the top of the hierarchy.'}
          </DialogDescription>
        </div>
        <DialogClose onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          <Field
            label="Location type"
            htmlFor="location-type"
            required
            error={typeError ?? undefined}
            hint={
              typeError
                ? undefined
                : 'A state must sit under a country, an LGA under a state, and a city or town under an LGA.'
            }
          >
            <Select
              id="location-type"
              value={type}
              invalid={typeError !== null}
              onChange={(e) => setType(e.target.value as LocationType)}
            >
              {availableTypes.map((value) => (
                <option key={value} value={value}>
                  {locationTypeLabels[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Name"
            htmlFor="location-name"
            required
            error={nameError ?? undefined}
          >
            <Input
              id="location-name"
              value={name}
              invalid={nameError !== null}
              placeholder="e.g. Eti-Osa"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field
            label="Code"
            htmlFor="location-code"
            hint="Optional. The short uppercase code used in ID sequences, e.g. LA for STA/LA/2026/0001."
          >
            <Input
              id="location-code"
              value={code}
              maxLength={6}
              placeholder="LA"
              className="font-mono uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>

          <Field label="Parent" htmlFor="location-parent">
            <Input
              id="location-parent"
              readOnly
              disabled
              value={parent ? locationPath(parent.id) : '— no parent —'}
            />
          </Field>

          <div className="flex items-start gap-2.5 rounded-lg border border-warning-500/30 bg-warning-50 p-3">
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0 text-warning-700"
              aria-hidden
            />
            <p className="text-xs text-warning-900">
              Locations created by an Admin enter{' '}
              <span className="font-semibold">pending</span> status and require
              Super Admin approval before they can be used on a job posting or
              an application.
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            loadingText="Creating…"
            disabled={typeError !== null || availableTypes.length === 0}
          >
            Create location
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
