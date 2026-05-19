import { cookies } from 'next/headers'
import { fetchBuiltinSuppliers } from '@/lib/suppliers'
import { getUserFromToken, COOKIE_NAME } from '@/lib/session'
import { getUserName } from '@/lib/user-names-server'
import { getRole } from '@/lib/roles'
import { getUserPermissions } from '@/lib/permissions-server'
import { getModulos } from '@/lib/sistema-db'
import PriceComparator from '@/components/PriceComparator'

export const revalidate = 0

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? ''
  const username = getUserFromToken(token) ?? ''
  const displayName = username ? await getUserName(username) : ''
  const role = getRole(username)
  const permissions = username ? await getUserPermissions(username) : null
  const suppliers = await fetchBuiltinSuppliers()
  const modulosConfig = getModulos()
  return (
    <PriceComparator
      initialSuppliers={suppliers}
      currentUser={username}
      initialDisplayName={displayName}
      role={role}
      permissions={permissions}
      modulosConfig={modulosConfig}
    />
  )
}
