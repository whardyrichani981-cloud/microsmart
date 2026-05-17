export interface SupplierItem {
  name: string
  code: string
  price: number
  stock?: string
  category?: string
}

export interface SupplierColor {
  bg: string
  border: string
  text: string
}

export interface Supplier {
  id: string
  name: string
  items: SupplierItem[]
  color: SupplierColor
  source: 'builtin' | 'upload'
  error?: string
}

export interface MergedRow {
  key: string
  name: string
  code: string
  category?: string
  prices: Record<string, number> // supplierId -> price
  stocks: Record<string, string>  // supplierId -> stock status
}
