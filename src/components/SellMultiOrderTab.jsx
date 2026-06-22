import React, { useEffect, useMemo, useState } from 'react'
import '../App.css'
import { useMultiOrderTable } from '../hooks/useMultiOrderTable'
import MultiOrderTable from './MultiOrderTable'
import ConfirmationDialog from './ConfirmationDialog'

function SellMultiOrderTab({ backendBase = '', setStatus }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [stockSuggestions, setStockSuggestions] = useState([])
  const [selectedStock, setSelectedStock] = useState('')
  const [openEntries, setOpenEntries] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [sellOrderType, setSellOrderType] = useState('MARKET')
  const [sellPrice, setSellPrice] = useState('')
  const [brokerFilter, setBrokerFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionSummary, setSubmissionSummary] = useState(null)

  const {
    orders,
    addOrder,
    deleteOrder,
    updateOrder,
    duplicateOrder,
    clearOrders,
    getBrokerWiseCount,
    orderCount,
  } = useMultiOrderTable()

  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setStockSuggestions([])
      return
    }

    let active = true
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true)
      try {
        const res = await fetch(
          `${backendBase}/api/order/distinct-stock-names?search=${encodeURIComponent(searchTerm.trim())}`,
          { headers: { 'Content-Type': 'application/json' } }
        )
        const data = await res.json()
        if (!active) return
        if (res.ok && Array.isArray(data.stocks)) {
          setStockSuggestions(data.stocks.map((item) => item.stock_name))
        } else {
          setStockSuggestions([])
        }
      } catch (err) {
        console.error('Error fetching stock suggestions:', err)
        setStockSuggestions([])
      } finally {
        if (active) setLoadingSuggestions(false)
      }
    }

    fetchSuggestions()
    return () => {
      active = false
    }
  }, [searchTerm, backendBase])

  const filteredEntries = useMemo(() => {
    return openEntries.filter((entry) => {
      const brokerMatches = brokerFilter === 'all' || entry.broker_name === brokerFilter
      const accountMatches = accountFilter === 'all' || entry.account_name === accountFilter
      return brokerMatches && accountMatches
    })
  }, [openEntries, brokerFilter, accountFilter])

  const availableBrokers = useMemo(() => {
    return Array.from(new Set(openEntries.map((entry) => entry.broker_name).filter(Boolean))).sort()
  }, [openEntries])

  const availableAccounts = useMemo(() => {
    const entries = brokerFilter === 'all'
      ? openEntries
      : openEntries.filter((entry) => entry.broker_name === brokerFilter)

    return Array.from(new Set(entries.map((entry) => entry.account_name).filter(Boolean))).sort()
  }, [openEntries, brokerFilter])

  const formatDate = (dateStr) => {
    if (!dateStr) return '--'
    const date = new Date(dateStr)
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yy = String(date.getFullYear()).slice(-2)
    return `${dd}-${mm}-${yy}`
  }

  const handleSelectStock = async (stockName) => {
    setSelectedStock(stockName)
    setSearchTerm(stockName)
    setStockSuggestions([])
    setBrokerFilter('all')
    setAccountFilter('all')
    setSelectedIds([])
    setLoadingEntries(true)
    setSubmissionSummary(null)

    try {
      const res = await fetch(
        `${backendBase}/api/order/open-transactions?symbol=${encodeURIComponent(stockName)}&limit=0`,
        { headers: { 'Content-Type': 'application/json' } }
      )
      const data = await res.json()
      if (res.ok) {
        setOpenEntries(data.data || [])
      } else {
        setOpenEntries([])
        setStatus({ type: 'error', message: data.error || 'Failed to load open entries' })
      }
    } catch (err) {
      console.error('Error loading open entries:', err)
      setOpenEntries([])
      setStatus({ type: 'error', message: 'Failed to load open entries' })
    } finally {
      setLoadingEntries(false)
    }
  }

  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleAddSelectedOrders = () => {
    if (!selectedStock) {
      setStatus({ type: 'error', message: 'Select a stock before adding orders' })
      return
    }

    if (selectedIds.length === 0) {
      setStatus({ type: 'error', message: 'Select at least one row to add to the queue' })
      return
    }

    if (sellOrderType === 'LIMIT' && (!sellPrice || Number(sellPrice) <= 0)) {
      setStatus({ type: 'error', message: 'Enter a valid sell price for limit orders' })
      return
    }

    const selectedRows = filteredEntries.filter((entry) => selectedIds.includes(entry.id))
    if (selectedRows.length === 0) {
      setStatus({ type: 'error', message: 'Selected rows are not available in the current filtered view' })
      return
    }

    selectedRows.forEach((entry) => {
      addOrder({
        stock: selectedStock,
        broker: entry.broker_name,
        account: entry.account_name,
        quantity: entry.quantity,
        orderType: sellOrderType,
        price: sellOrderType === 'LIMIT' ? Number(sellPrice) : null,
        transaction_id: entry.id,
      })
    })

    setStatus({ type: 'success', message: `${selectedRows.length} order${selectedRows.length !== 1 ? 's' : ''} added to queue` })
    setSelectedIds([])
    setSellPrice('')
  }

  const handlePlaceOrders = () => {
    if (orderCount === 0) {
      setStatus({ type: 'error', message: 'Add at least one order before placing.' })
      return
    }

    setShowConfirmation(true)
  }

  const handleConfirmPlaceOrders = async () => {
    setShowConfirmation(false)
    setSubmitting(true)
    setSubmissionSummary(null)

    try {
      const response = await fetch(`${backendBase}/api/orders/multi-sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: orders.map((order) => ({
            account_id: order.account,
            broker: order.broker,
            symbol: order.stock,
            quantity: order.quantity,
            order_type: order.orderType,
            price: order.orderType === 'LIMIT' ? order.price : null,
            transaction_id: order.transaction_id,
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setStatus({ type: 'error', message: data.error || 'Failed to place sell orders.' })
        return
      }

      const summary = data.summary || {}
      const totalSuccess = data.total?.success || 0
      const totalFailed = data.total?.failed || 0

      const messageParts = []
      Object.entries(summary).forEach(([broker, counts]) => {
        const parts = []
        if (counts.success) parts.push(`${counts.success} success`)
        if (counts.failed) parts.push(`${counts.failed} failed`)
        messageParts.push(`${broker.charAt(0).toUpperCase() + broker.slice(1)}: ${parts.join(', ')}`)
      })

      const finalMessage = `Order placement completed. ${totalSuccess} successful${totalSuccess !== 1 ? 's' : ''}${totalFailed ? `, ${totalFailed} failed` : ''}.`
      setStatus({ type: totalFailed > 0 ? 'error' : 'success', message: finalMessage })
      setSubmissionSummary({ summary, totalSuccess, totalFailed })

      if (totalFailed === 0) {
        clearOrders()
      }
    } catch (err) {
      console.error('Multi sell submit error:', err)
      setStatus({ type: 'error', message: err.message || 'Network error while placing sell orders.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearQueue = () => {
    clearOrders()
    setStatus({ type: 'success', message: 'Order queue cleared' })
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Multi Sell Order</h2>

      <div className="row">
        <div>
          <label className="label" htmlFor="sellStockSearch">Search Stock</label>
          <div className="dropdown">
            <input
              id="sellStockSearch"
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type stock name..."
              autoComplete="off"
            />
            {loadingSuggestions && <div className="suggestions"><div className="spinner" /><p>Searching...</p></div>}
            {!loadingSuggestions && stockSuggestions.length > 0 && (
              <div className="suggestions">
                {stockSuggestions.map((stockName, index) => (
                  <button
                    key={`${stockName}-${index}`}
                    type="button"
                    className="suggestion"
                    onClick={() => handleSelectStock(stockName)}
                  >
                    {stockName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedStock && (
        <>
          <div className="row grid-2" style={{ alignItems: 'flex-end', marginTop: '16px' }}>
            <div>
              <label className="label" htmlFor="sellBrokerFilter">Broker</label>
              <select
                id="sellBrokerFilter"
                className="select"
                value={brokerFilter}
                onChange={(e) => { setBrokerFilter(e.target.value); setAccountFilter('all'); setSelectedIds([]) }}
              >
                <option value="all">All</option>
                {availableBrokers.map((brokerName) => (
                  <option key={brokerName} value={brokerName}>{brokerName.charAt(0).toUpperCase() + brokerName.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sellAccountFilter">Account</label>
              <select
                id="sellAccountFilter"
                className="select"
                value={accountFilter}
                onChange={(e) => { setAccountFilter(e.target.value); setSelectedIds([]) }}
              >
                <option value="all">All</option>
                {availableAccounts.map((accountName) => (
                  <option key={accountName} value={accountName}>{accountName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row grid-2" style={{ alignItems: 'flex-end', marginTop: '16px' }}>
            <div>
              <label className="label" htmlFor="sellOrderType">Order Type</label>
              <select
                id="sellOrderType"
                className="select"
                value={sellOrderType}
                onChange={(e) => setSellOrderType(e.target.value)}
              >
                <option value="MARKET">Market</option>
                <option value="LIMIT">Limit</option>
              </select>
            </div>
            <div>
              {sellOrderType === 'LIMIT' && (
                <>
                  <label className="label" htmlFor="sellPrice">Sell Price</label>
                  <input
                    id="sellPrice"
                    className="input"
                    type="number"
                    min="0"
                    step="0.05"
                    placeholder="Enter sell price"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                  />
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            {loadingEntries ? (
              <div className="empty-state"><div className="spinner" /><p>Loading entries...</p></div>
            ) : (
              <>
                {filteredEntries.length === 0 ? (
                  <p style={{ color: '#94a3b8', margin: 0 }}>No open entries found for this stock with the selected filters.</p>
                ) : (
                  <div className="table-container" style={{ marginTop: 12 }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '48px' }}>Select</th>
                          <th>Stock</th>
                          <th>Broker</th>
                          <th>Account</th>
                          <th>Qty Available</th>
                          <th>Buy Price</th>
                          <th>Buy Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => (
                          <tr
                            key={entry.id}
                            style={{ backgroundColor: selectedIds.includes(entry.id) ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(entry.id)}
                                onChange={() => handleSelectRow(entry.id)}
                              />
                            </td>
                            <td>{entry.stock_name}</td>
                            <td>{entry.broker_name}</td>
                            <td>{entry.account_name}</td>
                            <td>{entry.quantity}</td>
                            <td>{entry.buy_price}</td>
                            <td>{formatDate(entry.buy_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              className="button"
              onClick={handleAddSelectedOrders}
              disabled={selectedIds.length === 0 || (sellOrderType === 'LIMIT' && (!sellPrice || Number(sellPrice) <= 0))}
            >
              Add Selected Orders
            </button>
            <button
              type="button"
              className="button"
              style={{ background: '#6b7280' }}
              onClick={() => {
                setSelectedStock('')
                setSearchTerm('')
                setOpenEntries([])
                setSelectedIds([])
                setSellPrice('')
                setBrokerFilter('all')
                setAccountFilter('all')
              }}
            >
              Change Stock
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          <button
            type="button"
            className="button"
            style={{ background: orderCount === 0 ? '#9ca3af' : '#dc2626' }}
            onClick={handlePlaceOrders}
            disabled={orderCount === 0 || submitting}
          >
            {submitting ? 'Submitting...' : 'Place Orders'}
          </button>
          <button
            type="button"
            className="button"
            style={{ background: '#6b7280' }}
            onClick={handleClearQueue}
            disabled={orderCount === 0 || submitting}
          >
            Clear All
          </button>
        </div>
        <div style={{ marginTop: '8px', color: '#94a3b8' }}>{orderCount} queued order{orderCount !== 1 ? 's' : ''}</div>
      </div>

      <div style={{ marginTop: '18px' }}>
        <MultiOrderTable
          orders={orders}
          onUpdate={updateOrder}
          onDelete={deleteOrder}
          onDuplicate={duplicateOrder}
          backendBase={backendBase}
        />
      </div>

      {submissionSummary && (
        <div style={{ marginTop: '16px', padding: '16px', border: '1px solid rgba(148, 163, 184, 0.24)', borderRadius: '8px', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
          <h3 style={{ marginTop: 0 }}>Order Execution Summary</h3>
          {Object.entries(submissionSummary.summary || {}).map(([broker, info]) => (
            <div key={broker} style={{ marginBottom: '10px' }}>
              <strong>{broker.charAt(0).toUpperCase() + broker.slice(1)}:</strong>
              <div style={{ marginLeft: '12px', color: '#cbd5e1' }}>
                <div>Success: {info.success}</div>
                <div>Failed: {info.failed}</div>
                {info.errors && info.errors.length > 0 && (
                  <div style={{ marginTop: '6px' }}>
                    {info.errors.map((error, index) => (
                      <div key={`${broker}-error-${index}`} style={{ fontSize: '12px', color: '#fca5a5' }}>
                        {error.symbol}: {error.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={handleConfirmPlaceOrders}
        onCancel={() => setShowConfirmation(false)}
        brokerWiseCounts={getBrokerWiseCount()}
        totalOrders={orderCount}
      />
    </div>
  )
}

export default SellMultiOrderTab
