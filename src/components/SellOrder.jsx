import React, { useEffect, useState } from 'react'
import '../App.css'
import SellMultiOrderTab from './SellMultiOrderTab'
import ConfirmationDialog from './ConfirmationDialog'
const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)

export default function SellOrder({ backendBase = '', setStatus, status }) {
  const [sellBroker, setSellBroker] = useState('')
  const [sellAccount, setSellAccount] = useState('')
  const [distinctBrokers, setDistinctBrokers] = useState([])
  const [distinctAccounts, setDistinctAccounts] = useState([])
  const [sellStockSearch, setSellStockSearch] = useState('')
  const [sellStockSuggestions, setSellStockSuggestions] = useState([])
  const [selectedSellStock, setSelectedSellStock] = useState(null)
  const [openEntries, setOpenEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [loadingBrokers, setLoadingBrokers] = useState(true)
  const [showSellModal, setShowSellModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [sellQuantity, setSellQuantity] = useState('')
  const [sellMode, setSellMode] = useState('FULL')
  const [sellOrderType, setSellOrderType] = useState('MARKET')
  const [sellPrice, setSellPrice] = useState('')
  const [maxQuantity, setMaxQuantity] = useState(0)
  const [submittingSell, setSubmittingSell] = useState(false)
  const [showSellConfirm, setShowSellConfirm] = useState(false)
  const [ltp, setLtp] = useState(null)
  const [activeTab, setActiveTab] = useState('single')

  const resetSellFilters = () => {
    setSellBroker('')
    setSellAccount('')
    setSellStockSearch('')
    setSellStockSuggestions([])
    setSelectedSellStock(null)
    setOpenEntries([])
    setSelectedEntry(null)
    setSellQuantity('')
    setSellPrice('')
    setMaxQuantity(0)
    setLtp(null)
    setShowSellModal(false)
  }

  useEffect(() => {
    loadDistinctBrokersAndAccounts()
  }, [])

  const loadDistinctBrokersAndAccounts = async () => {
    setLoadingBrokers(true)
    try {
      const res = await fetch(`${backendBase}/api/order/distinct-brokers-accounts`, {
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.brokers && data.accounts) {
        setDistinctBrokers(data.brokers)
        setDistinctAccounts(data.accounts)
      }
    } catch (err) {
      console.error('Error loading distinct values:', err)
      setStatus({ type: 'error', message: 'Failed to load broker and account options' })
    } finally {
      setLoadingBrokers(false)
    }
  }

  const handleSellStockSearch = async (e) => {
    const term = e.target.value
    setSellStockSearch(term)

    const trimmedTerm = term.trim()
    if (!trimmedTerm) {
      setSellStockSuggestions([])
      return
    }

    try {
      const queryParams = []
      if (sellBroker) queryParams.push(`broker_name=${encodeURIComponent(sellBroker)}`)
      if (sellAccount) queryParams.push(`account_name=${encodeURIComponent(sellAccount)}`)
      queryParams.push(`search=${encodeURIComponent(trimmedTerm)}`)

      const res = await fetch(
        `${backendBase}/api/order/distinct-stock-names?${queryParams.join('&')}`,
        { headers: { 'Content-Type': 'application/json' } }
      )
      const data = await res.json()
      if (data.stocks) {
        setSellStockSuggestions(data.stocks)
      }
    } catch (err) {
      console.error('Error searching stocks:', err)
    }
  }

  const handleSelectSellStock = async (stock) => {
    setSelectedSellStock(stock)
    setSellStockSearch(stock.stock_name)
    setSellStockSuggestions([])
    setLoadingEntries(true)

    try {
      const res = await fetch(
        `${backendBase}/api/order/open-transactions?broker_name=${sellBroker}&account_name=${sellAccount}&symbol=${stock.stock_name}&page=1&limit=10000`,
        { headers: { 'Content-Type': 'application/json' } }
      )
      const data = await res.json()
      setOpenEntries(data.data || [])

      try {
        const masterRes = await fetch(`${backendBase}/api/buy-order/stock-master`)
        const masterData = await masterRes.json()
        const masterStock = masterData.stocks?.find(s => s.name === stock.stock_name)
        if (masterStock && masterStock.token) {
          setLtp(stock.cmp || null)
        }
      } catch (err) {
        console.error('Error fetching LTP:', err)
      }
    } catch (err) {
      console.error('Error loading entries:', err)
      setStatus({ type: 'error', message: 'Failed to load open entries' })
    } finally {
      setLoadingEntries(false)
    }
  }

  const handleOpenSellModal = (entry) => {
    setSelectedEntry(entry)
    setSellMode('FULL')
    setSellQuantity(String(entry.quantity))
    setMaxQuantity(entry.quantity)
    setSellOrderType('MARKET')
    setSellPrice('')
    setShowSellModal(true)
  }

  const handlePlaceSellOrder = async () => {
    const sellQty = parseInt(sellQuantity)
    if (!sellQty || sellQty <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid quantity' })
      return
    }
    if (sellQty > maxQuantity) {
      setStatus({ type: 'error', message: `Quantity cannot exceed ${maxQuantity}` })
      return
    }
    if (sellOrderType === 'LIMIT' && (!sellPrice || parseFloat(sellPrice) <= 0)) {
      setStatus({ type: 'error', message: 'Please enter a valid limit price' })
      return
    }

    setSubmittingSell(true)

    try {
      const res = await fetch(`${backendBase}/api/order/place-sell-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: sellBroker,
          account_id: sellAccount,
          symbol: selectedSellStock.stock_name,
          quantity: sellQty,
          price: sellOrderType === 'MARKET' ? null : parseFloat(sellPrice),
          transaction_id: selectedEntry.id,
          token: selectedSellStock.symbol_token,
          order_type: sellOrderType
        })
      })

      const data = await res.json()

      if (res.ok) {
        setStatus({ type: 'success', message: `Sell order placed successfully. Order ID: ${data.order_id || 'N/A'}` })
        setShowSellModal(false)
        setSellStockSearch('')
        setSellQuantity('')
        setSellPrice('')
        setSelectedEntry(null)
        setOpenEntries([])
        setSelectedSellStock(null)
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to place sell order' })
      }
    } catch (err) {
      console.error('Error placing sell order:', err)
      setStatus({ type: 'error', message: err.message || 'Network error while placing order' })
    } finally {
      setSubmittingSell(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '--'
    const date = new Date(dateStr)
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yy = String(date.getFullYear()).slice(-2)
    return `${dd}-${mm}-${yy}`
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        borderBottom: '2px solid #e0e0e0',
      }}>
        <button
          onClick={() => setActiveTab('single')}
          style={{
            padding: '12px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'single' ? '3px solid #2196F3' : 'transparent',
            color: activeTab === 'single' ? '#2196F3' : '#666',
            fontWeight: activeTab === 'single' ? '600' : '500',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
          }}
        >
          Single Order
        </button>
        <button
          onClick={() => setActiveTab('multi')}
          style={{
            padding: '12px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'multi' ? '3px solid #2196F3' : 'transparent',
            color: activeTab === 'multi' ? '#2196F3' : '#666',
            fontWeight: activeTab === 'multi' ? '600' : '500',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
          }}
        >
          Multi Order
        </button>
      </div>

      <div style={{ display: activeTab === 'single' ? 'block' : 'none' }}>
        <div className="card">
          <h1>Sell Order Entry</h1>
          {loadingBrokers ? (
        <div className="empty-state"><div className="spinner" /><p>Loading options...</p></div>
      ) : (
        <>
          <div className="row grid-2" style={{ alignItems: 'flex-end', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div>
              <label className="label" htmlFor="sellBroker">Broker</label>
              <select 
                id="sellBroker" 
                className="select" 
                value={sellBroker} 
                onChange={(e) => { setSellBroker(e.target.value); setSellStockSearch(''); setOpenEntries([]) }}
              >
                <option value="">Select broker</option>
                {distinctBrokers.map(b => (
                  <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sellAccount">Account</label>
              <select 
                id="sellAccount" 
                className="select" 
                value={sellAccount} 
                onChange={(e) => { setSellAccount(e.target.value); setSellStockSearch(''); setOpenEntries([]) }}
              >
                <option value="">Select account</option>
                {distinctAccounts.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row grid-2" style={{ alignItems: 'flex-end', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div>
              <label className="label" htmlFor="sellStock">Stock</label>
              <div className="dropdown">
                <input
                  id="sellStock"
                  className="input"
                  value={sellStockSearch}
                  onChange={handleSellStockSearch}
                  placeholder={sellBroker && sellAccount ? 'Type stock name to search...' : 'Select broker and account first'}
                  autoComplete="off"
                  disabled={!sellBroker || !sellAccount}
                />
                {sellStockSuggestions.length > 0 && (
                  <div className="suggestions">
                    {sellStockSuggestions.map((item, index) => (
                      <button
                        key={`${item.stock_name}-${index}`}
                        type="button"
                        className="suggestion"
                        onClick={() => handleSelectSellStock(item)}
                      >
                        {item.stock_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button"
                style={{ background: '#6b7280', padding: '10px 16px', width: '100%' }}
                onClick={resetSellFilters}
              >
                ⟳ Reset
              </button>
            </div>
          </div>

          <div className="row">
            <div>
              <label className="label" htmlFor="sellStock">Stock</label>
              <div className="dropdown">
                <input
                  id="sellStock"
                  className="input"
                  value={sellStockSearch}
                  onChange={handleSellStockSearch}
                  placeholder={sellBroker && sellAccount ? 'Type stock name to search...' : 'Select broker and account first'}
                  autoComplete="off"
                  disabled={!sellBroker || !sellAccount}
                />
                {sellStockSuggestions.length > 0 && (
                  <div className="suggestions">
                    {sellStockSuggestions.map((item, index) => (
                      <button
                        key={`${item.stock_name}-${index}`}
                        type="button"
                        className="suggestion"
                        onClick={() => handleSelectSellStock(item)}
                      >
                        {item.stock_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedSellStock && (
            <>
              <div style={{ marginTop: 20, marginBottom: 20, padding: 16, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0' }}>Open Entries for {selectedSellStock.stock_name}</h3>
                {loadingEntries ? (
                  <div className="empty-state"><div className="spinner" /><p>Loading entries...</p></div>
                ) : openEntries.length === 0 ? (
                  <p style={{ color: '#94a3b8', margin: 0 }}>No open entries found for this stock</p>
                ) : (
                  <div className="table-container" style={{ marginTop: 12 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Buy Date</th>
                          <th>Qty</th>
                          <th>Entry Price</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openEntries.map((entry, index) => (
                          <tr key={`${entry.id}-${index}`}>
                            <td>{formatDate(entry.buy_date)}</td>
                            <td>{entry.quantity}</td>
                            <td>{formatCurrency(entry.buy_price)}</td>
                            <td>
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleOpenSellModal(entry)}
                              >
                                Sell
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {showSellModal && selectedEntry && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>Sell {selectedSellStock.stock_name}</h2>
                  <button 
                    className="modal-close" 
                    onClick={() => setShowSellModal(false)}
                  >×</button>
                </div>
                <div className="modal-body">
                  <div className="row">
                    <div>
                      <label className="label">Max Available: {maxQuantity}</label>
                    </div>
                  </div>

                  <div className="row grid-2">
                    <div>
                      <label className="label">Quantity to Sell</label>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <label className="radio-row">
                          <input
                            type="radio"
                            name="sellMode"
                            value="FULL"
                            checked={sellMode === 'FULL'}
                            onChange={() => {
                              setSellMode('FULL')
                              setSellQuantity(String(maxQuantity))
                            }}
                          />
                          Full ({maxQuantity} units)
                        </label>
                        <label className="radio-row">
                          <input
                            type="radio"
                            name="sellMode"
                            value="PARTIAL"
                            checked={sellMode === 'PARTIAL'}
                            onChange={() => {
                              setSellMode('PARTIAL')
                              setSellQuantity('')
                            }}
                          />
                          Partial quantity
                        </label>
                        {sellMode === 'PARTIAL' && (
                          <input
                            id="modalSellQty"
                            className="input"
                            type="number"
                            min="1"
                            max={maxQuantity}
                            placeholder="Enter quantity to sell"
                            value={sellQuantity}
                            onChange={(e) => setSellQuantity(e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="modalOrderType">Order Type</label>
                      <select 
                        id="modalOrderType"
                        className="select" 
                        value={sellOrderType} 
                        onChange={(e) => setSellOrderType(e.target.value)}
                      >
                        <option value="MARKET">Market</option>
                        <option value="LIMIT">Limit</option>
                      </select>
                    </div>
                  </div>

                  {sellOrderType === 'LIMIT' && (
                    <div className="row">
                      <div>
                        <label className="label" htmlFor="modalSellPrice">Limit Price</label>
                        <input
                          id="modalSellPrice"
                          className="input"
                          type="number"
                          min="0"
                          step="0.05"
                          placeholder="Enter limit price"
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {sellQuantity && sellPrice && sellOrderType === 'LIMIT' && (
                    <div className="hint-box">
                      Estimated Value: {formatCurrency(parseInt(sellQuantity) * parseFloat(sellPrice))}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="button" 
                    style={{ background: '#6b7280' }}
                    onClick={() => setShowSellModal(false)}
                    disabled={submittingSell}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="button"
                    style={{ background: '#dc2626' }}
                    onClick={() => setShowSellConfirm(true)}
                    disabled={submittingSell || !sellQuantity || (sellOrderType === 'LIMIT' && !sellPrice)}
                  >
                    {submittingSell ? 'Placing order...' : 'Place Sell Order'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {status && activeTab === 'single' && <div className={`status ${status.type}`}>{status.message}</div>}
        </div>
      </div>

      <div style={{ display: activeTab === 'multi' ? 'block' : 'none' }}>
        <SellMultiOrderTab backendBase={backendBase} setStatus={setStatus} />
      </div>
    </div>
  )
}

// helper defined inside file
function formatDate(dateStr) {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  return `${dd}-${mm}-${yy}`
}
