import { fetchBuiltinSuppliers } from '@/lib/suppliers'
import PriceComparator from '@/components/PriceComparator'

export const revalidate = 3600

export default async function Home() {
  const suppliers = await fetchBuiltinSuppliers()
  return <PriceComparator initialSuppliers={suppliers} />
}
