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
  const resolvedBackendBase = (backendBase || (import.meta.env.DEV ? 'http://localhost:3001' : '')).trim()
  const [sellBroker, setSellBroker] = useState([])
  const [sellAccount, setSellAccount] = useState([])
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
  const [sellStockRestricted, setSellStockRestricted] = useState(false)
  const [sellStockRestrictionMessage, setSellStockRestrictionMessage] = useState('')
  const [maxQuantity, setMaxQuantity] = useState(0)
  const [submittingSell, setSubmittingSell] = useState(false)
  const [showSellConfirm, setShowSellConfirm] = useState(false)
  const [ltp, setLtp] = useState(null)
  const [ltpLoading, setLtpLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('single')
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  const resetSellFilters = () => {
    setSellBroker([])
    setSellAccount([])
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

  useEffect(() => {
    if (!selectedSellStock?.stock_name) {
      setLtp(null)
      setLtpLoading(false)
      return undefined
    }

    let active = true

    const refreshLivePrice = async () => {
      setLtpLoading(true)

      try {
        const subscribeRes = await fetch(`${resolvedBackendBase}/api/order/subscribe-stock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: selectedSellStock.stock_name,
            exchange: selectedSellStock.exchange || '',
          }),
        })

        if (!subscribeRes.ok) {
          throw new Error('Failed to subscribe to live price updates')
        }

        const priceRes = await fetch(
          `${resolvedBackendBase}/api/order/live-price/${encodeURIComponent(selectedSellStock.stock_name)}?exchange=${encodeURIComponent(selectedSellStock.exchange || '')}`
        )
        const priceData = await priceRes.json()

        if (!active) return

        if (priceData?.ltp != null && !Number.isNaN(Number(priceData.ltp))) {
          setLtp(Number(priceData.ltp))
        } else {
          setLtp(selectedSellStock.cmp || null)
        }
      } catch (err) {
        console.error('Error refreshing LTP:', err)
        if (active) {
          setLtp(selectedSellStock.cmp || null)
        }
      } finally {
        if (active) {
          setLtpLoading(false)
        }
      }
    }

    refreshLivePrice()
    const intervalId = window.setInterval(refreshLivePrice, 5000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [backendBase, selectedSellStock?.stock_name, selectedSellStock?.exchange])

  const loadDistinctBrokersAndAccounts = async () => {
    setLoadingBrokers(true)
    try {
      const res = await fetch(`${resolvedBackendBase}/api/order/distinct-brokers-accounts`, {
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

  const toggleBrokerSelection = (broker) => {
    setSellBroker(prev => {
      const updated = prev.includes(broker) 
        ? prev.filter(b => b !== broker)
        : [...prev, broker]
      
      // If there's a selected stock, reload entries with new broker selection
      if (selectedSellStock) {
        reloadEntriesForStock(selectedSellStock, updated, sellAccount)
      }
      return updated
    })
    setSellStockSearch('')
  }

  const toggleAccountSelection = (account) => {
    setSellAccount(prev => {
      const updated = prev.includes(account) 
        ? prev.filter(a => a !== account)
        : [...prev, account]
      
      // If there's a selected stock, reload entries with new account selection
      if (selectedSellStock) {
        reloadEntriesForStock(selectedSellStock, sellBroker, updated)
      }
      return updated
    })
    setSellStockSearch('')
  }

  const checkSellStockSurveillance = async (stockName) => {
    const normalized = String(stockName || '').trim()
    if (!normalized) {
      setSellStockRestricted(false)
      setSellStockRestrictionMessage('')
      return
    }

    try {
      const res = await fetch(`${resolvedBackendBase}/api/surveillance/check/${encodeURIComponent(normalized)}`)
      const data = await res.json().catch(() => null)

      if (res.ok && data?.restricted) {
        setSellStockRestricted(true)
        setSellStockRestrictionMessage(data.message || `Market orders are blocked for ${normalized}. Please place a limit order.`)
        setSellOrderType('LIMIT')
      } else {
        setSellStockRestricted(false)
        setSellStockRestrictionMessage('')
      }
    } catch (err) {
      console.error('Sell surveillance check failed:', err)
      setSellStockRestricted(false)
      setSellStockRestrictionMessage('')
    }
  }

  const reloadEntriesForStock = async (stock, brokers, accounts) => {
    if (!stock || brokers.length === 0 || accounts.length === 0) {
      setOpenEntries([])
      return
    }

    setLoadingEntries(true)
    try {
      const brokerParam = brokers.join(',')
      const accountParam = accounts.join(',')
      const res = await fetch(
        `${resolvedBackendBase}/api/order/open-transactions?broker_names=${encodeURIComponent(brokerParam)}&account_names=${encodeURIComponent(accountParam)}&symbol=${stock.stock_name}&page=1&limit=10000`,
        { headers: { 'Content-Type': 'application/json' } }
      )
      const data = await res.json()
      setOpenEntries(data.data || [])
    } catch (err) {
      console.error('Error loading entries:', err)
      setStatus({ type: 'error', message: 'Failed to load open entries' })
      setOpenEntries([])
    } finally {
      setLoadingEntries(false)
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
      if (sellBroker.length > 0) queryParams.push(`broker_names=${encodeURIComponent(sellBroker.join(','))}`)
      if (sellAccount.length > 0) queryParams.push(`account_names=${encodeURIComponent(sellAccount.join(','))}`)
      queryParams.push(`search=${encodeURIComponent(trimmedTerm)}`)

      const res = await fetch(
        `${resolvedBackendBase}/api/order/distinct-stock-names?${queryParams.join('&')}`,
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
    setLtp(null)
    setLtpLoading(true)
    setSellStockSearch(stock.stock_name)
    setSellStockSuggestions([])

    try {
      const masterRes = await fetch(`${resolvedBackendBase}/api/buy-order/stock-master`)
      const masterData = await masterRes.json()
      const masterStock = masterData.stocks?.find((s) => s.name === stock.stock_name)
      const enrichedStock = {
        ...stock,
        symbol_token: stock.symbol_token || masterStock?.token || '',
        exchange: stock.exchange || masterStock?.exchange || '',
      }

      setSelectedSellStock(enrichedStock)
      await checkSellStockSurveillance(enrichedStock.stock_name)
      await reloadEntriesForStock(enrichedStock, sellBroker, sellAccount)
    } catch (err) {
      console.error('Error fetching master stock metadata:', err)
      setSelectedSellStock(stock)
      await checkSellStockSurveillance(stock.stock_name)
      await reloadEntriesForStock(stock, sellBroker, sellAccount)
      setLtp(stock.cmp || null)
    } finally {
      setLtpLoading(false)
    }
  }

  const handleOpenSellModal = (entry) => {
    setSelectedEntry(entry)
    setSellMode('FULL')
    setSellQuantity(String(entry.quantity))
    setMaxQuantity(entry.quantity)
    setSellOrderType(sellStockRestricted ? 'LIMIT' : 'MARKET')
    setSellPrice('')
    setShowSellModal(true)
  }

  const handleConfirmSellOrder = async () => {
    setShowSellConfirm(false)
    await handlePlaceSellOrder()
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
      const res = await fetch(`${resolvedBackendBase}/api/order/place-sell-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: sellBroker[0],
          account_id: sellAccount[0],
          symbol: selectedSellStock.stock_name,
          quantity: sellQty,
          price: sellOrderType === 'MARKET' ? null : parseFloat(sellPrice),
          transaction_id: selectedEntry.id,
          token: selectedSellStock.symbol_token,
          exchange: selectedSellStock.exchange,
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
            <div style={{ position: 'relative' }}>
              <label className="label">Broker</label>
              <button
                type="button"
                className="select"
                onClick={() => setShowBrokerDropdown(!showBrokerDropdown)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span>{sellBroker.length === 0 ? 'Select broker' : `${sellBroker.length} selected`}</span>
                <span>{showBrokerDropdown ? '▼' : '▶'}</span>
              </button>
              {showBrokerDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 10,
                  marginTop: '4px',
                }}>
                  {distinctBrokers.map(b => (
                    <label key={b} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #374151',
                    }}>
                      <input
                        type="checkbox"
                        checked={sellBroker.includes(b)}
                        onChange={() => toggleBrokerSelection(b)}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <label className="label">Account</label>
              <button
                type="button"
                className="select"
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span>{sellAccount.length === 0 ? 'Select account' : `${sellAccount.length} selected`}</span>
                <span>{showAccountDropdown ? '▼' : '▶'}</span>
              </button>
              {showAccountDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 10,
                  marginTop: '4px',
                }}>
                  {distinctAccounts.map(a => (
                    <label key={a} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      color: '#e5e7eb',
                      borderBottom: '1px solid #374151',
                    }}>
                      <input
                        type="checkbox"
                        checked={sellAccount.includes(a)}
                        onChange={() => toggleAccountSelection(a)}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              )}
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
                  placeholder={sellBroker.length > 0 && sellAccount.length > 0 ? 'Type stock name to search...' : 'Select broker and account first'}
                  autoComplete="off"
                  disabled={sellBroker.length === 0 || sellAccount.length === 0}
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
                  placeholder={sellBroker.length > 0 && sellAccount.length > 0 ? 'Type stock name to search...' : 'Select broker and account first'}
                  autoComplete="off"
                  disabled={sellBroker.length === 0 || sellAccount.length === 0}
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
                  <>
                    <div style={{
                      backgroundColor: '#d97706',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'center',
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.9 }}>Total Qty</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>
                          {openEntries.reduce((sum, entry) => sum + entry.quantity, 0)}
                        </div>
                      </div>
                      <div style={{ height: '30px', width: '1px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.9 }}>Avg Buy Price</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>
                          ₹{(openEntries.reduce((sum, entry) => sum + (entry.quantity * entry.buy_price), 0) / openEntries.reduce((sum, entry) => sum + entry.quantity, 0)).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ height: '30px', width: '1px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.9 }}>LTP / CMP</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>
                          {ltpLoading ? '...' : (ltp != null ? `₹${Number(ltp).toFixed(2)}` : '--')}
                        </div>
                      </div>
                    </div>
                    <div className="table-container" style={{ marginTop: 12 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Buy Date</th>
                            <th>Qty</th>
                            <th>Price</th>
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
                  </>
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
                        onChange={(e) => {
                          const nextType = e.target.value
                          if (sellStockRestricted && nextType === 'MARKET') {
                            setStatus({ type: 'error', message: sellStockRestrictionMessage || `Market orders are blocked for ${selectedSellStock?.stock_name}. Please place a limit order.` })
                            setSellOrderType('LIMIT')
                            return
                          }
                          setSellOrderType(nextType)
                        }}
                      >
                        <option value="MARKET">Market</option>
                        <option value="LIMIT">Limit</option>
                      </select>
                      {sellStockRestricted && (
                        <div className="hint-box" style={{ marginTop: 8, background: '#fde68a', color: '#92400e' }}>
                          {sellStockRestrictionMessage || `Market orders are blocked for ${selectedSellStock?.stock_name}. Please place a limit order.`}
                        </div>
                      )}
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

          <ConfirmationDialog
            isOpen={showSellConfirm}
            onConfirm={handleConfirmSellOrder}
            onCancel={() => setShowSellConfirm(false)}
            title="Confirm Sell Order"
            confirmLabel="Place Sell Order"
            cancelLabel="Cancel"
            message={`You are about to sell ${sellQuantity || 0} unit${Number(sellQuantity) === 1 ? '' : 's'} of ${selectedSellStock?.stock_name || 'this stock'}${sellOrderType === 'LIMIT' ? ` at ₹${sellPrice}` : ' at market price'}.`}
          />
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
