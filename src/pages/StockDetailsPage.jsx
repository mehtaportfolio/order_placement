import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const formatWholeNumber = (value) => Math.round(Number(value) || 0).toLocaleString('en-IN')
const getPnlColor = (value) => Number(value) > 0 ? '#22c55e' : Number(value) < 0 ? '#ef4444' : '#cbd5e1'
const formatDate = (value) => {
  if (!value) return '-'

  const dateParts = String(value).slice(0, 10).split('-')
  if (dateParts.length !== 3) return '-'

  const [year, month, day] = dateParts
  return `${day}-${month}-${year.slice(-2)}`
}

const StockDetailsPage = ({ backendBase = '' }) => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedStock, setSelectedStock] = useState('')
  const [status, setStatus] = useState('open')
  const [view, setView] = useState('open')
  const [details, setDetails] = useState(null)
  const [masterDetails, setMasterDetails] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [showTransactions, setShowTransactions] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = search.trim()
    if (!query || query === selectedStock) {
      setSuggestions([])
      return undefined
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true)
      setError('')
      try {
        const response = await fetch(`${backendBase}/api/buy-order/stock-details/stocks?search=${encodeURIComponent(query)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to search stocks')
        setSuggestions(Array.isArray(data.stocks) ? data.stocks : [])
      } catch (err) {
        setError(err.message || 'Failed to search stocks')
        setSuggestions([])
      } finally {
        setLoadingSuggestions(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [backendBase, search, selectedStock])

  useEffect(() => {
    if (!selectedStock) {
      setDetails(null)
      return undefined
    }

    const loadDetails = async () => {
      setLoadingDetails(true)
      setError('')
      try {
        const response = await fetch(`${backendBase}/api/buy-order/stock-details?stock_name=${encodeURIComponent(selectedStock)}&status=${status}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load stock details')
        setDetails(data)
      } catch (err) {
        setError(err.message || 'Failed to load stock details')
        setDetails(null)
      } finally {
        setLoadingDetails(false)
      }
    }

    loadDetails()
  }, [backendBase, selectedStock, status])

  const selectStock = (stock) => {
    setSelectedStock(stock)
    setSearch(stock)
    setView('open')
    setMasterDetails(null)
    setTransactions([])
    setShowTransactions(false)
    setSuggestions([])
  }

  const loadTransactions = async () => {
    if (showTransactions) {
      setShowTransactions(false)
      return
    }

    setShowTransactions(true)
    setLoadingDetails(true)
    setError('')

    try {
      const response = await fetch(`${backendBase}/api/buy-order/stock-details/transactions?stock_name=${encodeURIComponent(selectedStock)}&status=${status}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load transactions')
      setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
    } catch (err) {
      setError(err.message || 'Failed to load transactions')
      setTransactions([])
    } finally {
      setLoadingDetails(false)
    }
  }

  const transactionColumns = [
    { key: 'account_name', label: 'Account', type: 'text' },
    { key: 'buy_date', label: 'Buy Date', type: 'date' },
    ...(status === 'open'
      ? [
          { key: 'quantity', label: 'Qty', type: 'number' },
          { key: 'buy_price', label: 'Buy Price', type: 'number' },
          { key: 'cmp', label: 'CMP', type: 'number' },
        ]
      : [
          { key: 'sell_date', label: 'Sell Date', type: 'date' },
          { key: 'quantity', label: 'Qty', type: 'number' },
          { key: 'buy_price', label: 'Buy Price', type: 'number' },
          { key: 'sell_price', label: 'Sell Price', type: 'number' },
        ]),
    { key: 'investedValue', label: 'Invested Value', type: 'number' },
    { key: 'exitValue', label: status === 'open' ? 'Market Value' : 'Sell Value', type: 'number' },
    { key: 'pnl', label: 'P/L', type: 'number' },
    { key: 'pnlPercent', label: 'P/L%', type: 'number' },
  ]

  const sortedTransactions = [...transactions].sort((first, second) => {
    if (!sortConfig.key) return 0

    const getSortValue = (transaction) => {
      const quantity = Number(transaction.quantity) || 0
      const buyPrice = Number(transaction.buy_price) || 0
      const sellPrice = Number(transaction.sell_price) || 0
      const investedValue = quantity * buyPrice
      const exitValue = status === 'open'
        ? quantity * (Number(details?.cmp) || 0)
        : quantity * sellPrice
      const pnl = exitValue - investedValue
      const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0

      return {
        account_name: transaction.account_name || '',
        buy_date: transaction.buy_date || '',
        quantity,
        buy_price: buyPrice,
        sell_price: sellPrice,
        sell_date: transaction.sell_date || '',
        cmp: Number(details?.cmp) || 0,
        investedValue,
        exitValue,
        pnl,
        pnlPercent,
      }[sortConfig.key]
    }

    const firstValue = getSortValue(first)
    const secondValue = getSortValue(second)
    const comparison = typeof firstValue === 'string'
      ? firstValue.localeCompare(secondValue)
      : firstValue - secondValue

    return sortConfig.direction === 'asc' ? comparison : -comparison
  })

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const loadMasterDetails = async () => {
    setView('master')
    setLoadingDetails(true)
    setError('')

    try {
      const response = await fetch(`${backendBase}/api/buy-order/stock-details/master?stock_name=${encodeURIComponent(selectedStock)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load stock master details')
      setMasterDetails(data)
    } catch (err) {
      setError(err.message || 'Failed to load stock master details')
      setMasterDetails(null)
    } finally {
      setLoadingDetails(false)
    }
  }

  return (
    <section className="card stock-details-page">
      <div className="stock-details-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Stock Details</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back to Dashboard"
          title="Back to Dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            flexShrink: 0,
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 10,
            background: 'rgba(148, 163, 184, 0.12)',
            color: '#f8fafc',
            cursor: 'pointer',
          }}
        >
          <FiArrowLeft size={20} />
        </button>
      </div>
      <div className="stock-details-search-row" style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 560 }}>
        <div className="stock-details-search-field" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input
            className="input"
            value={search}
            placeholder="Search stock name"
            onChange={(event) => {
              setSearch(event.target.value)
              if (event.target.value !== selectedStock) setSelectedStock('')
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 2, width: '100%', marginTop: 4, background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 10, overflow: 'hidden' }}>
              {suggestions.map((stock) => (
                <button key={stock} type="button" onClick={() => selectStock(stock)} style={{ display: 'block', width: '100%', padding: '12px 14px', border: 0, borderBottom: '1px solid rgba(148, 163, 184, 0.12)', background: 'transparent', color: '#e2e8f0', textAlign: 'left', cursor: 'pointer' }}>
                  {stock}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedStock && (
          <button type="button" className="button stock-details-transactions-button" onClick={loadTransactions} style={{ width: 'auto', flexShrink: 0, whiteSpace: 'nowrap', padding: '12px 16px' }}>
            <span className="stock-details-transactions-label-full">
              {showTransactions ? `Hide ${status === 'open' ? 'Open' : 'Closed'} Transactions` : 'All Transactions'}
            </span>
            <span className="stock-details-transactions-label-short">
              {showTransactions ? 'Hide' : 'All'}
            </span>
          </button>
        )}
      </div>

      {loadingSuggestions && <p style={{ color: '#94a3b8' }}>Searching...</p>}
      {error && <p style={{ color: '#fca5a5' }}>{error}</p>}

      {selectedStock && (
        <div className="stock-details-mode-actions" style={{ display: 'flex', gap: 12, margin: '20px 0', maxWidth: 560 }}>
          {['open', 'close'].map((option) => (
            <button key={option} type="button" className="button" onClick={() => { setStatus(option); setView(option); setShowTransactions(false) }} style={{ background: view === option ? '#0e7490' : 'rgba(148, 163, 184, 0.2)', color: '#f8fafc' }}>
              {option === 'open' ? 'Open' : 'Close'}
            </button>
          ))}
          <button type="button" className="button" onClick={loadMasterDetails} style={{ background: view === 'master' ? '#0e7490' : 'rgba(148, 163, 184, 0.2)', color: '#f8fafc' }}>
            Details
          </button>
        </div>
      )}

      {loadingDetails && <p style={{ color: '#94a3b8' }}>Loading details...</p>}
      {view !== 'master' && details && !loadingDetails && (
        <table className="stock-details-summary-table" style={{ width: '100%', maxWidth: 560, marginBottom: 24, borderCollapse: 'collapse', textAlign: 'left' }}>
          <tbody>
            <tr><th>Stock Name</th><td>{details.stock_name}</td></tr>
            <tr><th>Total Quantity</th><td>{formatNumber(details.total_quantity)}</td></tr>
            <tr><th>Total Invested Value</th><td>{formatNumber(details.total_invested_value)}</td></tr>
            <tr><th>Avg Buy Price</th><td>{formatNumber(details.avg_buy_price)}</td></tr>
          {status === 'open' ? (
            <>
              <tr><th>CMP</th><td>{formatNumber(details.cmp)}</td></tr>
              <tr><th>Total Market Value</th><td>{formatNumber(details.total_market_value)}</td></tr>
            </>
          ) : (
            <>
              <tr><th>Avg Sell Price</th><td>{formatNumber(details.avg_sell_price)}</td></tr>
              <tr><th>Total Sell Value</th><td>{formatNumber(details.total_sell_value)}</td></tr>
            </>
          )}
            <tr><th>Total P/L</th><td style={{ color: getPnlColor(details.total_pnl) }}>{formatNumber(details.total_pnl)}</td></tr>
            <tr><th>P/L%</th><td style={{ color: getPnlColor(details.pnl_percent) }}>{formatNumber(details.pnl_percent)}%</td></tr>
          </tbody>
        </table>
      )}

      {view === 'master' && masterDetails && !loadingDetails && (
        <table className="stock-details-summary-table" style={{ width: '100%', maxWidth: 560, marginBottom: 24, borderCollapse: 'collapse', textAlign: 'left' }}>
          <tbody>
            <tr><th>Stock Name</th><td>{masterDetails.stock_name}</td></tr>
            <tr><th>Industry</th><td>{masterDetails.industry || '-'}</td></tr>
            <tr><th>Sector</th><td>{masterDetails.sector || '-'}</td></tr>
            <tr><th>Category</th><td>{masterDetails.category || '-'}</td></tr>
            <tr><th>Macro Sector</th><td>{masterDetails.macro_sector || '-'}</td></tr>
            <tr><th>Known Sector</th><td>{masterDetails.known_sector || '-'}</td></tr>
            <tr><th>Basic Industry</th><td>{masterDetails.basic_industry || '-'}</td></tr>
            <tr><th>ISIN</th><td>{masterDetails.isin || '-'}</td></tr>
            <tr><th>S Broad Sector</th><td>{masterDetails.s_broad_sector || '-'}</td></tr>
            <tr><th>S Sector</th><td>{masterDetails.s_sector || '-'}</td></tr>
            <tr><th>S Broad Industry</th><td>{masterDetails.s_broad_industry || '-'}</td></tr>
            <tr><th>S Industry</th><td>{masterDetails.s_industry || '-'}</td></tr>
          </tbody>
        </table>
      )}

      {showTransactions && !loadingDetails && (
        <div className="stock-details-transactions-scroll" style={{ overflowX: 'auto', marginTop: 16, marginBottom: 24 }}>
          {transactions.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No {status} transactions found for this stock.</p>
          ) : (
            <table className="stock-details-transactions-table" style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid rgba(148, 163, 184, 0.25)', color: '#cbd5e1' }}>#</th>
                  {transactionColumns.map((column) => (
                    <th key={column.key} style={{ padding: '10px 8px', borderBottom: '1px solid rgba(148, 163, 184, 0.25)', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => handleSort(column.key)} style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {column.label}{sortConfig.key === column.key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((transaction, index) => {
                  const quantity = Number(transaction.quantity) || 0
                  const buyPrice = Number(transaction.buy_price) || 0
                  const sellPrice = Number(transaction.sell_price) || 0
                  const investedValue = quantity * buyPrice
                  const exitValue = status === 'open'
                    ? quantity * (Number(details?.cmp) || 0)
                    : quantity * sellPrice
                  const pnl = exitValue - investedValue
                  const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0

                  return (
                    <tr key={transaction.id || `${transaction.stock_name}-${transaction.buy_date}-${index}`}>
                      <td style={{ padding: '10px 8px' }}>{index + 1}</td>
                      <td style={{ padding: '10px 8px' }}>{transaction.account_name || '-'}</td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{formatDate(transaction.buy_date)}</td>
                      {status === 'open' ? (
                        <>
                          <td style={{ padding: '10px 8px' }}>{formatNumber(transaction.quantity)}</td>
                          <td style={{ padding: '10px 8px' }}>{formatNumber(transaction.buy_price)}</td>
                          <td style={{ padding: '10px 8px' }}>{formatNumber(details?.cmp)}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{formatDate(transaction.sell_date)}</td>
                          <td style={{ padding: '10px 8px' }}>{formatNumber(transaction.quantity)}</td>
                          <td style={{ padding: '10px 8px' }}>{formatNumber(transaction.buy_price)}</td>
                          <td style={{ padding: '10px 8px' }}>{formatNumber(transaction.sell_price)}</td>
                        </>
                      )}
                      <td style={{ padding: '10px 8px' }}>{formatWholeNumber(investedValue)}</td>
                      <td style={{ padding: '10px 8px' }}>{formatWholeNumber(exitValue)}</td>
                      <td style={{ padding: '10px 8px', color: getPnlColor(pnl) }}>{formatWholeNumber(pnl)}</td>
                      <td style={{ padding: '10px 8px', color: getPnlColor(pnlPercent) }}>{formatNumber(pnlPercent)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

    </section>
  )
}

export default StockDetailsPage