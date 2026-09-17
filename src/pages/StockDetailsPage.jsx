import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

const StockDetailsPage = ({ backendBase = '' }) => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedStock, setSelectedStock] = useState('')
  const [status, setStatus] = useState('open')
  const [view, setView] = useState('open')
  const [details, setDetails] = useState(null)
  const [masterDetails, setMasterDetails] = useState(null)
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
    setSuggestions([])
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
    <section className="card">
      <h1>Stock Details</h1>
      <div style={{ position: 'relative', maxWidth: 560 }}>
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

      {loadingSuggestions && <p style={{ color: '#94a3b8' }}>Searching...</p>}
      {error && <p style={{ color: '#fca5a5' }}>{error}</p>}

      {selectedStock && (
        <div style={{ display: 'flex', gap: 12, margin: '20px 0', maxWidth: 560 }}>
          {['open', 'close'].map((option) => (
            <button key={option} type="button" className="button" onClick={() => { setStatus(option); setView(option) }} style={{ background: view === option ? '#0e7490' : 'rgba(148, 163, 184, 0.2)', color: '#f8fafc' }}>
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
        <div style={{ display: 'grid', gap: 12, maxWidth: 560, marginBottom: 24 }}>
          <div><strong>Stock Name:</strong> {details.stock_name}</div>
          <div><strong>Total Quantity:</strong> {formatNumber(details.total_quantity)}</div>
          <div><strong>Avg Buy Price:</strong> {formatNumber(details.avg_buy_price)}</div>
          <div><strong>{status === 'open' ? 'CMP' : 'Avg Sell Price'}:</strong> {formatNumber(status === 'open' ? details.cmp : details.avg_sell_price)}</div>
          <div><strong>Total P/L:</strong> {formatNumber(details.total_pnl)}</div>
          <div><strong>P/L%:</strong> {formatNumber(details.pnl_percent)}%</div>
        </div>
      )}

      {view === 'master' && masterDetails && !loadingDetails && (
        <div style={{ display: 'grid', gap: 12, maxWidth: 560, marginBottom: 24 }}>
          <div><strong>Stock Name:</strong> {masterDetails.stock_name}</div>
          <div><strong>Industry:</strong> {masterDetails.industry || '-'}</div>
          <div><strong>Sector:</strong> {masterDetails.sector || '-'}</div>
          <div><strong>Category:</strong> {masterDetails.category || '-'}</div>
          <div><strong>Macro Sector:</strong> {masterDetails.macro_sector || '-'}</div>
          <div><strong>Known Sector:</strong> {masterDetails.known_sector || '-'}</div>
          <div><strong>Basic Industry:</strong> {masterDetails.basic_industry || '-'}</div>
          <div><strong>ISIN:</strong> {masterDetails.isin || '-'}</div>
          <div><strong>S Broad Sector:</strong> {masterDetails.s_broad_sector || '-'}</div>
          <div><strong>S Sector:</strong> {masterDetails.s_sector || '-'}</div>
          <div><strong>S Broad Industry:</strong> {masterDetails.s_broad_industry || '-'}</div>
          <div><strong>S Industry:</strong> {masterDetails.s_industry || '-'}</div>
        </div>
      )}

      <button type="button" className="button" onClick={() => navigate('/')} style={{ maxWidth: 560 }}>
        Back to Dashboard
      </button>
    </section>
  )
}

export default StockDetailsPage