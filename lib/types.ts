export interface SupplierItem {
  name: string
  code: string
  price: number       // primary price (USD when available)
  priceARS?: number   // secondary price in ARS/pesos (when list has both)
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
  prices: Record<string, number>    // supplierId -> primary price (USD)
  pricesARS: Record<string, number> // supplierId -> ARS price (when available)
  stocks: Record<string, string>    // supplierId -> stock status
}

export type SortState = { col: string; dir: 1 | -1 }
