// Microsmart icon set — portado de icons.jsx
// Todos los iconos heredan `currentColor`, stroke 1.5px.

import type { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function Icon({ children, size = 20, ...p }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      {children}
    </svg>
  )
}

export function IconLogo({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="2" y="3.5" width="20" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6 14V8.5l3 2.5 3-2.5V14M14 14V8.5l3 2.5 3-2.5V14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="20.5" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function IconHome({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  )
}

export function IconOrders({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </Icon>
  )
}

export function IconInv({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M3.5 7l8.5-4 8.5 4-8.5 4-8.5-4z" />
      <path d="M3.5 7v10l8.5 4 8.5-4V7" />
      <path d="M12 11v10" />
    </Icon>
  )
}

export function IconUsers({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 11.5a3 3 0 100-6" />
      <path d="M21 19c0-2.4-1.8-4-4-4" />
    </Icon>
  )
}

export function IconStats({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </Icon>
  )
}

export function IconSearch({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Icon>
  )
}

export function IconPlus({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function IconChev({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M9 5l7 7-7 7" />
    </Icon>
  )
}

export function IconChevDown({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M5 9l7 7 7-7" />
    </Icon>
  )
}

export function IconArrow({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </Icon>
  )
}

export function IconBell({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M6 17V11a6 6 0 1112 0v6" />
      <path d="M4 17h16" />
      <path d="M10 20a2 2 0 004 0" />
    </Icon>
  )
}

export function IconMore({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconPhone({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </Icon>
  )
}

export function IconWatch({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="3" />
      <path d="M9 6.5l1-3h4l1 3M9 17.5l1 3h4l1-3" />
    </Icon>
  )
}

export function IconLaptop({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </Icon>
  )
}

export function IconPad({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M11 18h2" />
    </Icon>
  )
}

export function IconCheck({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M5 12l4.5 4.5L19 7" />
    </Icon>
  )
}

export function IconClock({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function IconWrench({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M14 4a5 5 0 015 6l5 5-3 3-5-5a5 5 0 01-6-5l2 2 2-2-2-2 2-2z" />
    </Icon>
  )
}

export function IconTag({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M3.5 12.5l8-8h6v6l-8 8a2 2 0 01-2.8 0L3.5 15.3a2 2 0 010-2.8z" />
      <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconFilter({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />
    </Icon>
  )
}

export function IconBack({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  )
}

export function IconLock({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 018 0v3.5" />
    </Icon>
  )
}

export function IconEye({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </Icon>
  )
}

export function IconTrend({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M3 17l6-6 4 4 8-9" />
      <path d="M14 6h7v7" />
    </Icon>
  )
}

// Icono de cambio de modo (sol/luna) — no estaba en el original, es útil para el toggle
export function IconSun({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Icon>
  )
}

export function IconMoon({ size = 20, ...p }: IconProps) {
  return (
    <Icon size={size} {...p}>
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
    </Icon>
  )
}
