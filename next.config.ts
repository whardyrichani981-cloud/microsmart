import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['xlsx', 'pg', 'pg-native'],
}

export default config
