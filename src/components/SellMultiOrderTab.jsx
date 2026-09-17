import { useEffect, useMemo, useRef, useState } from 'react'
import '../App.css'
import { FiDownload, FiUpload } from 'react-icons/fi'
import { useMultiOrderTable } from '../hooks/useMultiOrderTable'
import MultiOrderTable from './MultiOrderTable'
import ConfirmationDialog from './ConfirmationDialog'

function SellMultiOrderTab({ backendBase = '', setStatus }) {
  const resolvedBackendBase = (backendBase || (import.meta.env.DEV ? 'http://localhost:3001' : '')).trim()
  const [searchTerm, setSearchTerm] = useState('')
  const [stockSuggestions, setStockSuggestions] = useState([])
  const [selectedStock, setSelectedStock] = useState('')
  const [openEntries, setOpenEntries] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [sellOrderType, setSellOrderType] = useState('MARKET')
  const [sellStockRestricted, setSellStockRestricted] = useState(false)
  const [sellStockRestrictionMessage, setSellStockRestrictionMessage] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [brokerFilter, setBrokerFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionSummary, setSubmissionSummary] = useState(null)
  const [ltp, setLtp] = useState(null)
  const [ltpLoading, setLtpLoading] = useState(false)
  const fileInputRef = useRef(null)

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
      return
    }

    let active = true
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true)
      try {
        const res = await fetch(
          `${resolvedBackendBase}/api/order/distinct-stock-names?search=${encodeURIComponent(searchTerm.trim())}`,
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
  }, [searchTerm, resolvedBackendBase])

  useEffect(() => {
    if (!selectedStock) {
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
            symbol: selectedStock,
            exchange: '',
          }),
        })

        if (!subscribeRes.ok) {
          throw new Error('Failed to subscribe to live price updates')
        }

        const priceRes = await fetch(
          `${resolvedBackendBase}/api/order/live-price/${encodeURIComponent(selectedStock)}?exchange=${encodeURIComponent('')}`
        )
        const priceData = await priceRes.json()

        if (!active) return

        if (priceData?.ltp != null && !Number.isNaN(Number(priceData.ltp))) {
          setLtp(Number(priceData.ltp))
        } else {
          setLtp(null)
        }
      } catch (err) {
        console.error('Error refreshing LTP:', err)
        if (active) {
          setLtp(null)
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
  }, [resolvedBackendBase, selectedStock])

  const filteredEntries = useMemo(() => {
    return openEntries.filter((entry) => {
      const brokerMatches = brokerFilter === 'all' || entry.broker_name === brokerFilter
      const accountMatches = accountFilter === 'all' || entry.account_name === accountFilter
      return brokerMatches && accountMatches
    })
  }, [openEntries, brokerFilter, accountFilter])

  const stockSummary = useMemo(() => {
    if (!selectedStock || filteredEntries.length === 0) return null

    const totalQuantity = filteredEntries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)
    const totalCost = filteredEntries.reduce((sum, entry) => sum + Number(entry.buy_price || 0) * Number(entry.quantity || 0), 0)
    const avgBuyPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0

    return {
      totalQuantity,
      avgBuyPrice,
      totalInvestmentValue: totalQuantity * avgBuyPrice,
    }
  }, [filteredEntries, selectedStock])

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

    await checkSellStockSurveillance(stockName)

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

  const checkSellStockSurveillance = async (stockName) => {
    const normalized = String(stockName || '').trim()
    if (!normalized) {
      setSellStockRestricted(false)
      setSellStockRestrictionMessage('')
      return
    }

    try {
      const res = await fetch(`${backendBase}/api/surveillance/check/${encodeURIComponent(normalized)}`)
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

  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const parseCsvTemplate = (csvText) => {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) {
      return []
    }

    const parseRow = (row) => {
      const values = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []
      return values.map((value) => value.replace(/^"|"$/g, '').trim())
    }

    const normalizeHeader = (text) => text.trim().toLowerCase().replace(/[-_\s]/g, '')
    const rawHeaders = parseRow(lines[0])
    const headerMap = rawHeaders.reduce((map, header) => {
      const key = normalizeHeader(header)
      if (key === 'stock') map[key] = 'stock'
      if (key === 'broker') map[key] = 'broker'
      if (key === 'account') map[key] = 'account'
      if (key === 'ordertype' || key === 'order_type' || key === 'type') map[key] = 'orderType'
      if (key === 'price' || key === 'limitprice') map[key] = 'price'
      return map
    }, {})

    const rows = []
    for (let i = 1; i < lines.length; i += 1) {
      const values = parseRow(lines[i])
      const row = {}
      rawHeaders.forEach((header, index) => {
        const normalized = normalizeHeader(header)
        const key = headerMap[normalized]
        if (key) {
          row[key] = values[index] ?? ''
        }
      })
      rows.push(row)
    }

    return rows
  }

  const handleDownloadTemplate = () => {
    const headers = ['stock', 'broker', 'account', 'orderType', 'price']
    const sampleRow = ['INFY', 'zerodha', 'PM', 'MARKET', '']
    const guidance = [
      '# Sample row above shows how to fill the template',
      '# The uploaded stock will add all open holdings rows for the selected stock, broker, and account',
      '# Delete any individual row from the order table if you do not want to sell that lot',
      '# Allowed values: broker = zerodha or angel',
      '# account = PM, PDM, or PSM',
      '# orderType = MARKET or LIMIT',
      '# price = required for LIMIT orders; leave blank for MARKET orders',
    ]

    const lines = [
      headers.join(','),
      sampleRow.join(','),
      '',
      ...guidance,
    ]

    const content = `${lines.join('\n')}\n`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'multi-sell-template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleTemplateUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const rows = parseCsvTemplate(text)
    let addedCount = 0
    const errors = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const stock = String(row.stock || '').trim()
      const broker = String(row.broker || '').trim()
      const account = String(row.account || '').trim()
      const orderType = String(row.orderType || 'MARKET').trim().toUpperCase() || 'MARKET'
      const price = row.price != null && row.price !== '' ? Number(row.price) : null

      if (!stock) {
        errors.push(`Row ${index + 2}: stock is required.`)
        continue
      }
      if (!broker) {
        errors.push(`Row ${index + 2}: broker is required.`)
        continue
      }
      if (!account) {
        errors.push(`Row ${index + 2}: account is required.`)
        continue
      }
      if (orderType !== 'MARKET' && orderType !== 'LIMIT') {
        errors.push(`Row ${index + 2}: orderType must be MARKET or LIMIT.`)
        continue
      }
      if (orderType === 'LIMIT' && (!Number.isFinite(price) || price <= 0)) {
        errors.push(`Row ${index + 2}: valid price is required for LIMIT orders.`)
        continue
      }

      try {
        const url = new URL(`${resolvedBackendBase}/api/order/open-transactions`)
        url.searchParams.set('symbol', stock)
        url.searchParams.set('broker_name', broker)
        url.searchParams.set('account_name', account)
        url.searchParams.set('limit', '0')

        const response = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json' } })
        const payload = await response.json()
        if (!response.ok || !Array.isArray(payload.data) || payload.data.length === 0) {
          errors.push(`Row ${index + 2}: no open holdings found for ${stock} in ${account} with ${broker}.`)
          continue
        }

        payload.data.forEach((entry) => {
          addOrder({
            stock,
            broker,
            account,
            quantity: Number(entry.quantity),
            orderType,
            price: orderType === 'LIMIT' ? price : null,
            buyPrice: Number(entry.buy_price),
            transaction_type: 'SELL',
            transaction_id: entry.id,
          })
          addedCount += 1
        })
      } catch (err) {
        console.error('Error fetching open entries for template upload:', err)
        errors.push(`Row ${index + 2}: failed to load holdings for ${stock}.`)
      }
    }

    event.target.value = ''

    if (addedCount === 0 && errors.length > 0) {
      setStatus({ type: 'error', message: `Template upload failed. ${errors.join(' ')}` })
      return
    }

    const summaryMessage = `${addedCount} row${addedCount !== 1 ? 's' : ''} added to queue${errors.length > 0 ? `, ${errors.length} row${errors.length !== 1 ? 's' : ''} skipped` : ''}.`
    setStatus({ type: errors.length > 0 ? 'error' : 'success', message: summaryMessage })
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

    if (sellStockRestricted && sellOrderType === 'MARKET') {
      setStatus({ type: 'error', message: sellStockRestrictionMessage || 'Market sell orders are blocked for this stock. Please choose Limit.' })
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
        buyPrice: Number(entry.buy_price),
        transaction_type: 'SELL',
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
            transaction_type: order.transaction_type || 'SELL',
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

      {sellStockRestricted && sellStockRestrictionMessage && (
        <div className="hint" style={{ marginTop: '12px', color: '#f87171' }}>
          {sellStockRestrictionMessage}
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'flex-end' }}>
          <div>
            <label className="label" htmlFor="sellStockSearch">Search Stock</label>
            <div className="dropdown">
              <input
                id="sellStockSearch"
                className="input"
                value={searchTerm}
                onChange={(e) => {
                  const next = e.target.value
                  setSearchTerm(next)
                  if (!next || next.trim().length < 2) {
                    setStockSuggestions([])
                  }
                }}
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

          <button
            type="button"
            className="icon-button"
            onClick={handleDownloadTemplate}
            title="Download template"
          >
            <FiDownload size={20} />
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload template"
          >
            <FiUpload size={20} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleTemplateUpload}
        />
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(100px, 0.8fr) minmax(100px, 0.8fr)',
              alignItems: 'end',
              gap: '12px',
              marginTop: '16px',
              width: '100%',
            }}
          >
            <div style={{ minWidth: '0' }}>
              <label className="label" htmlFor="sellOrderType">Order Type</label>
              <select
                id="sellOrderType"
                className="select"
                value={sellOrderType}
                onChange={(e) => setSellOrderType(e.target.value)}
                disabled={sellStockRestricted}
              >
                <option value="MARKET">Market</option>
                <option value="LIMIT">Limit</option>
              </select>
            </div>

            <div style={{ minWidth: '0' }}>
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

          {stockSummary && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'nowrap',
                whiteSpace: 'nowrap',
                padding: '10px 12px',
                border: '1px solid rgba(251, 146, 60, 0.4)',
                borderRadius: '10px',
                backgroundColor: 'rgba(251, 146, 60, 0.18)',
                color: '#f97316',
                fontSize: '13px',
                minHeight: '44px',
                overflow: 'hidden',
                marginTop: '16px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.9 }}>Total Qty</div>
                <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>{stockSummary.totalQuantity}</div>
              </div>
              <div style={{ height: '30px', width: '1px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.9 }}>Avg Buy</div>
                <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>₹{stockSummary.avgBuyPrice.toFixed(2)}</div>
              </div>
              <div style={{ height: '30px', width: '1px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.9 }}>Total Invest</div>
                <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>₹{stockSummary.totalInvestmentValue.toFixed(2)}</div>
              </div>
              <div style={{ height: '30px', width: '1px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.9 }}>LTP / CMP</div>
                <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>
                  {ltpLoading ? '...' : (ltp != null ? `₹${Number(ltp).toFixed(2)}` : '--')}
                </div>
              </div>
            </div>
          )}

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
                          <th>Qty </th>
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
              disabled={
                selectedIds.length === 0 ||
                (sellOrderType === 'LIMIT' && (!sellPrice || Number(sellPrice) <= 0)) ||
                (sellStockRestricted && sellOrderType === 'MARKET')
              }
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
