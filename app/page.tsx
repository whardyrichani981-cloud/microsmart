import { cookies } from 'next/headers'
import { fetchBuiltinSuppliers } from '@/lib/suppliers'
import { getUserFromToken, COOKIE_NAME } from '@/lib/session'
import PriceComparator from '@/components/PriceComparator'

export const revalidate = 3600

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? ''
  const currentUser = getUserFromToken(token) ?? ''
  const suppliers = await fetchBuiltinSuppliers()
  return <PriceComparator initialSuppliers={suppliers} currentUser={currentUser} />
}
