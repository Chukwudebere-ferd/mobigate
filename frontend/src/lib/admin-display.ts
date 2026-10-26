import * as React from 'react'

export const ADMIN_FONT_SIZES = [14, 16, 18] as const
export type AdminFontSize = (typeof ADMIN_FONT_SIZES)[number]

export const ADMIN_DISPLAY_STORAGE_KEY = 'mgm.admin.fontSize'
export const DEFAULT_ADMIN_FONT_SIZE: AdminFontSize = 16

export function readAdminFontSize(): AdminFontSize {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_FONT_SIZE
  try {
    const raw = window.localStorage.getItem(ADMIN_DISPLAY_STORAGE_KEY)
    if (!raw) return DEFAULT_ADMIN_FONT_SIZE
    const parsed = Number(raw)
    return (ADMIN_FONT_SIZES as readonly number[]).includes(parsed)
      ? (parsed as AdminFontSize)
      : DEFAULT_ADMIN_FONT_SIZE
  } catch {
    return DEFAULT_ADMIN_FONT_SIZE
  }
}

export interface AdminDisplayContextValue {
  fontSize: AdminFontSize
  setFontSize: (size: AdminFontSize) => void
}

export const AdminDisplayContext =
  React.createContext<AdminDisplayContextValue | null>(null)

export function useAdminDisplay(): AdminDisplayContextValue {
  const context = React.useContext(AdminDisplayContext)
  if (!context) {
    throw new Error('useAdminDisplay must be used inside AdminDisplayProvider')
  }
  return context
}
