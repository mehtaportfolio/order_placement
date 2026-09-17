import { useState, useCallback, useMemo } from 'react'

/**
 * Hook for searching stocks from the stock master table
 * Supports incremental search/autocomplete
 */
export function useStockSearch(backendBase = '') {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Load stock master on first render
  const loadStockMaster = useCallback(async () => {
    if (stocks.length > 0) return
    setLoading(true)
    try {
      const res = await fetch(`${backendBase}/api/buy-order/stock-master`)
      const data = await res.json()
      if (res.ok) {
        setStocks(data.stocks || [])
      }
    } catch (err) {
      console.error('Failed to load stock master:', err)
    } finally {
      setLoading(false)
    }
  }, [backendBase, stocks.length])

  // Filter suggestions based on search term
  const suggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query || stocks.length === 0) return []
    return stocks.filter((item) => item && item.name && item.name.toLowerCase().includes(query)).slice(0, 20)
  }, [searchTerm, stocks])

  return {
    stocks,
    loading,
    searchTerm,
    setSearchTerm,
    suggestions,
    loadStockMaster,
  }
}
