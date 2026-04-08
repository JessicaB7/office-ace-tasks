/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as taskAssignment } from './task-assignment.tsx'
import { template as weeklyTasksDigest } from './weekly-tasks-digest.tsx'
import { template as dailyCompletedSummary } from './daily-completed-summary.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'task-assignment': taskAssignment,
  'weekly-tasks-digest': weeklyTasksDigest,
  'daily-completed-summary': dailyCompletedSummary,
}
