import { createBrowserRouter } from 'react-router-dom'

import { AdminShell } from '@/components/layout/admin-shell'
import { PublicShell } from '@/components/layout/public-shell'

import { AdminAccessCodesPage } from '@/pages/admin/access-codes'
import { AdminApplicationsPage } from '@/pages/admin/applications'
import { AdminAuditPage } from '@/pages/admin/audit'
import { AdminDashboardPage } from '@/pages/admin/dashboard'
import { AdminInterviewsPage } from '@/pages/admin/interviews'
import { AdminJobsPage } from '@/pages/admin/jobs'
import { AdminLocationsPage } from '@/pages/admin/locations'
import { AdminSettingsPage } from '@/pages/admin/settings'
import { AdminShortlistsPage } from '@/pages/admin/shortlists'
import { AdminStaffPage } from '@/pages/admin/staff'

import { ApplicantApplicationsPage } from '@/pages/applicant/applications'
import { ApplicantInterviewsPage } from '@/pages/applicant/interviews'
import { ApplicantPortalLayout } from '@/pages/applicant/layout'
import { ApplicantStatusPage } from '@/pages/applicant/status'

import { HomePage } from '@/pages/public/home'
import { CareersPage } from '@/pages/public/careers'
import { JobDetailPage } from '@/pages/public/job-detail'
import { ApplyPage } from '@/pages/public/apply'
import { ApplicationReceivedPage } from '@/pages/public/received'

import { StaffLayout } from '@/pages/staff/layout'
import { StaffOnboardingPage } from '@/pages/staff/onboarding'
import { StaffPortalPage } from '@/pages/staff/portal'

import { NotFoundPage } from '@/pages/not-found'
import { PreviewPage } from '@/pages/preview'

/**
 * The route table.
 *
 * Exported separately from the router so that a render harness can build a
 * static router from the same definitions and exercise every screen.
 */
export const routes = [
  // -- Design review index -------------------------------------------------
  // A developer-facing page listing every screen. It sits outside the
  // product shells so it renders in isolation.
  { path: '/preview', element: <PreviewPage /> },

  // -- Public site ---------------------------------------------------------
  {
    element: <PublicShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/careers', element: <CareersPage /> },
      { path: '/jobs/:slug', element: <JobDetailPage /> },
      { path: '/apply/:slug', element: <ApplyPage /> },
      { path: '/application/received', element: <ApplicationReceivedPage /> },
    ],
  },

  // -- Applicant portal ----------------------------------------------------
  {
    element: <ApplicantPortalLayout />,
    children: [
      { path: '/applicant', element: <ApplicantApplicationsPage /> },
      { path: '/applicant/applications/:id', element: <ApplicantStatusPage /> },
      { path: '/applicant/interviews', element: <ApplicantInterviewsPage /> },
    ],
  },

  // -- Staff portal --------------------------------------------------------
  {
    element: <StaffLayout />,
    children: [
      { path: '/staff', element: <StaffPortalPage /> },
      { path: '/staff/onboarding', element: <StaffOnboardingPage /> },
    ],
  },

  // -- Admin panel ---------------------------------------------------------
  {
    element: <AdminShell />,
    children: [
      { path: '/admin', element: <AdminDashboardPage /> },
      { path: '/admin/applications', element: <AdminApplicationsPage /> },
      { path: '/admin/jobs', element: <AdminJobsPage /> },
      { path: '/admin/interviews', element: <AdminInterviewsPage /> },
      { path: '/admin/shortlists', element: <AdminShortlistsPage /> },
      { path: '/admin/access-codes', element: <AdminAccessCodesPage /> },
      { path: '/admin/staff', element: <AdminStaffPage /> },
      { path: '/admin/locations', element: <AdminLocationsPage /> },
      { path: '/admin/settings', element: <AdminSettingsPage /> },
      { path: '/admin/audit', element: <AdminAuditPage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]

export function createRouter() {
  return createBrowserRouter(routes)
}
