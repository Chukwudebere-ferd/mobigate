import * as React from 'react'

import {
  ADMIN_DISPLAY_STORAGE_KEY,
  AdminDisplayContext,
  readAdminFontSize,
  type AdminFontSize,
} from '@/lib/admin-display'

/**
 * Applies the admin's preferred root font size while the admin shell is
 * mounted. The value is a personal display preference, so it lives in this
 * browser's localStorage rather than the database.
 */
export function AdminDisplayProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] =
    React.useState<AdminFontSize>(readAdminFontSize)

  const setFontSize = React.useCallback((size: AdminFontSize) => {
    setFontSizeState(size)
    try {
      window.localStorage.setItem(ADMIN_DISPLAY_STORAGE_KEY, String(size))
    } catch {
      // A blocked storage area should not break the settings screen.
    }
  }, [])

  React.useEffect(() => {
    const root = document.documentElement
    const previous = root.style.fontSize
    root.style.fontSize = `${fontSize}px`
    return () => {
      root.style.fontSize = previous
    }
  }, [fontSize])

  const value = React.useMemo(
    () => ({ fontSize, setFontSize }),
    [fontSize, setFontSize],
  )

  return (
    <AdminDisplayContext.Provider value={value}>
      {children}
    </AdminDisplayContext.Provider>
  )
}
