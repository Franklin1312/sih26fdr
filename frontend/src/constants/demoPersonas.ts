import {
  Award,
  Building2,
  Landmark,
  Search,
  Scale,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '../types/auth'

export interface DemoPersona {
  role: UserRole
  title: string
  name: string
  email: string
  icon: LucideIcon
  description: string
  landingPath: string
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    role: 'institution_rep',
    title: 'Institution Representative',
    name: 'Apex Institute of Technology',
    email: 'inst_rep_1@demo.example',
    icon: Building2,
    description: 'Submit FDRs, upload evidence, and respond to clarifications',
    landingPath: '/institution/dashboard',
  },
  {
    role: 'institution_rep',
    title: 'Institution Representative',
    name: 'National Medical College',
    email: 'inst_rep_2@demo.example',
    icon: Building2,
    description: 'Demo institution with an isolated deposit portfolio',
    landingPath: '/institution/dashboard',
  },
  {
    role: 'institution_rep',
    title: 'Institution Representative',
    name: 'City Polytechnic Institute',
    email: 'inst_rep_3@demo.example',
    icon: Building2,
    description: 'Demo institution with an isolated deposit portfolio',
    landingPath: '/institution/dashboard',
  },
  {
    role: 'institution_rep',
    title: 'Institution Representative',
    name: 'Eastern Management School',
    email: 'inst_rep_4@demo.example',
    icon: Building2,
    description: 'Demo institution with an isolated deposit portfolio',
    landingPath: '/institution/dashboard',
  },
  {
    role: 'scrutiny_officer',
    title: 'Scrutiny Officer',
    name: 'Scrutiny & Review Cell',
    email: 'scrutiny_1@demo.example',
    icon: Search,
    description: 'Review evidence, verify banks, and raise deficiencies',
    landingPath: '/scrutiny',
  },
  {
    role: 'clearance_officer',
    title: 'PGRC Officer',
    name: 'Public Grievance Redressal Cell',
    email: 'clearance_1@demo.example',
    icon: Scale,
    description: 'Clear the PGRC (Public Grievance Redressal Cell) task for each case',
    landingPath: '/clearance',
  },
  {
    role: 'clearance_officer',
    title: 'Vigilance Officer',
    name: 'Vigilance Bureau',
    email: 'clearance_2@demo.example',
    icon: Scale,
    description: 'Clear the Vigilance bureau task independently for each case',
    landingPath: '/clearance',
  },
  {
    role: 'clearance_officer',
    title: 'Technical Cell Officer',
    name: 'Technical Cell / Bureau',
    email: 'clearance_3@demo.example',
    icon: Scale,
    description: 'Clear the Technical Cell task — all three clearances must pass before a case progresses',
    landingPath: '/clearance',
  },
  {
    role: 'competent_authority',
    title: 'Competent Authority',
    name: 'Approval Authority',
    email: 'authority_1@demo.example',
    icon: Award,
    description: 'Review release requests and issue final decisions',
    landingPath: '/authority',
  },
  {
    role: 'approval_bureau',
    title: 'Approval Bureau',
    name: 'FDR / RPGF NOC Cell',
    email: 'approval_bureau_1@demo.example',
    icon: Landmark,
    description: 'Issue the simulated Approval Bureau NOC for FDR/RPGF',
    landingPath: '/release',
  },
  {
    role: 'council',
    title: 'Council Authority',
    name: 'RTGS Sanction Council',
    email: 'council_1@demo.example',
    icon: Landmark,
    description: 'Issue the simulated Council Sanction Order for RTGS',
    landingPath: '/release',
  },
  {
    role: 'system_admin',
    title: 'System Administrator',
    name: 'Root Administrator',
    email: 'admin_1@demo.example',
    icon: Settings,
    description: 'Manage users, institutions, settings, and audit integrity',
    landingPath: '/admin/audit',
  },
]
