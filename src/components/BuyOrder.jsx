import React, { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../App.css'
import MultiOrderTab from './MultiOrderTab'
import ConfirmationDialog from './ConfirmationDialog'

const ORDER_TYPES = [
  { value: 'LIMIT', label: 'Limit' },
  { value: 'MARKET', label: 'Market' },
]

const ACCOUNTS = [
  { value: '', label: 'Select account' },
  { value: 'PM', label: 'PM' },
  { value: 'PDM', label: 'PDM' },
  { value: 'PSM', label: 'PSM' },
]

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)

function SingleOrderComponent({ backendBase = '', setStatus }, ref) {
  const navigate = useNavigate()
  const location = useLocation()
  const [stock, setStock] = useState('')
  const [stocks, setStocks] = useState([])
  const [account, setAccount] = useState('PSM')
  const [broker, setBroker] = useState('zerodha')
  const [quantity, setQuantity] = useState('')
  const [orderType, setOrderType] = useState('MARKET')
  const [price, setPrice] = useState('')
  const [livePrice, setLivePrice] = useState(null)
  const [statusLocal, setStatusLocal] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showBuyConfirm, setShowBuyConfirm] = useState(false)
  const [showStockSuggestions, setShowStockSuggestions] = useState(false)
  const stockInputRef = useRef(null)

useEffect(() => {
  if (!stock) return

  const interval = setInterval(async () => {
    try {
      const response = await fetch(
        `${backendBase}/api/orders/live-price/${encodeURIComponent(stock)}-EQ`
      )

      const data = await response.json()

      if (data.ltp != null) {
        setLivePrice(data.ltp)
      }
    } catch (err) {
      console.error(err)
    }
  }, 2000)

  return () => clearInterval(interval)
}, [stock, backendBase])

  useEffect(() => {
    loadStockMaster()
  }, [])

  const loadStockMaster = async () => {
    try {
      const res = await fetch(`${backendBase}/api/buy-order/stock-master`)
      const data = await res.json()
      if (res.ok) {
        setStocks(data.stocks || [])
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to load stock list' })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to load stock list' })
    }
  }

const fetchLivePrice = async (symbol) => {
  if (!symbol?.trim()) {
    setLivePrice(null)
    return
  }

  try {
    const response = await fetch(
      `${backendBase}/api/orders/live-price/${encodeURIComponent(symbol.trim())}-EQ`
    )

    const data = await response.json()

    if (response.ok) {
      setLivePrice(data.ltp)
    } else {
      setLivePrice(null)
    }
  } catch (error) {
    console.error('Failed to fetch live price:', error)
    setLivePrice(null)
  }
}

  const validateForm = () => {
    if (!stock.trim()) return 'Stock is required.'
    if (!account) return 'Please select an account.'
    if (!broker) return 'Please select a broker.'
    if (!quantity || Number(quantity) <= 0) return 'Quantity must be greater than zero.'
    if (orderType === 'LIMIT' && (!price || Number(price) <= 0)) return 'Limit price is required for limit orders.'
    return null
  }

  const handlePlaceOrder = async () => {
    const error = validateForm()
    if (error) {
      setStatus({ type: 'error', message: error })
      return
    }
    setShowBuyConfirm(true)
  }

  const confirmPlaceOrder = async () => {
    setShowBuyConfirm(false)
    setSubmitting(true)
    setStatus(null)

    try {
      const res = await fetch(`${backendBase}/api/buy-order/place-buy-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: account,
          broker,
          symbol: stock.trim(),
          quantity: Number(quantity),
          order_type: orderType,
          transaction_type: 'BUY',
          price: orderType === 'LIMIT' ? Number(price) : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setStatus({ type: 'error', message: data.error || 'Order placement failed.' })
      } else {
        setStatus({ type: 'success', message: `Order placed successfully. Order ID: ${data.order_id || 'N/A'}` })
        setStock('')
        setQuantity('')
        setPrice('')
        setOrderType('LIMIT')
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Network error while placing order.' })
    } finally {
      setSubmitting(false)
    }
  }

  const stockSuggestions = useMemo(() => {
    const query = stock.trim().toLowerCase()
    if (!query) return []
    return stocks.filter((item) => item && item.name && item.name.toLowerCase().includes(query)).slice(0, 20)
  }, [stock, stocks])

  // expose method to parent to prefill trade form from positions
  useImperativeHandle(ref, () => ({
    prepareTradeForm: (tradeSide, pos) => {
      // only supporting BUY prefill here
      setStock(pos.symbol || pos.stock_name || '')
      setAccount(pos.account || '')
      setBroker((pos.broker || '').toLowerCase())
      setQuantity(String(pos.quantity || ''))
      setOrderType('MARKET')
      setPrice('')
    },
  }))

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Buy Order Entry</h1>
      </div>
      <div className="row">
        <div>
          <label className="label" htmlFor="stock">Stock</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="dropdown" style={{ flex: 1 }}>
              <input
                ref={stockInputRef}
                id="stock"
                className="input"
                value={stock}
onChange={(e) => {
  const value = e.target.value

  setStock(value)
  setShowStockSuggestions(Boolean(value.trim()))

  if (!value.trim()) {
    setLivePrice(null)
  }
}}
                onFocus={() => {
                  if (stock.trim()) setShowStockSuggestions(true)
                }}
                onBlur={() => {
                  setTimeout(() => setShowStockSuggestions(false), 150)
                }}
                placeholder="Type stock name..."
                autoComplete="off"
              />
              {stockSuggestions.length > 0 && showStockSuggestions && (
                <div className="suggestions">
                  {stockSuggestions.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      type="button"
                      className="suggestion"
onMouseDown={async () => {
  setStock(item.name)
  setShowStockSuggestions(false)

  setLivePrice(null)

  const symbol = `${item.name}-EQ`

  const fetchPrice = async () => {
    try {
      const response = await fetch(
        `${backendBase}/api/orders/live-price/${encodeURIComponent(symbol)}`
      )

      const data = await response.json()

      console.log('LTP Response:', data)

      if (data.ltp != null) {
        setLivePrice(data.ltp)
        return true
      }

      return false
    } catch (err) {
      console.error(err)
      return false
    }
  }

  // Try immediately
  let found = await fetchPrice()

  // If subscription still warming up, retry
  if (!found) {
    setTimeout(async () => {
      await fetchPrice()
    }, 2000)
  }
}}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/add-stock')}
              style={{
                border: '1px solid rgba(148, 163, 184, 0.35)',
                borderRadius: '8px',
                background: 'transparent',
                color: '#ffffff',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Add stock"
            >
              +
            </button>
            {stock.trim() && (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(
                      stock.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
                    )}`,
                    '_blank',
                    'noopener'
                  )
                }
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: '#ffffff',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Open TradingView chart"
                title="Open TradingView chart"
              >
                📈
              </button>
            )}

{stock && (
  <div
    style={{
      marginTop: 8,
      padding: '8px 12px',
      borderRadius: 8,
      background: '#D97706',
      fontWeight: 600
    }}
  >
    LTP: ₹{livePrice ?? '--'}
  </div>
)}
          </div>
        </div>
      </div>



      <div className="row grid-2">
        <div>
          <label className="label" htmlFor="account">Account</label>
          <select id="account" className="select" value={account} onChange={(e) => setAccount(e.target.value)}>
            {ACCOUNTS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="broker">Broker</label>
          <select id="broker" className="select" value={broker} onChange={(e) => setBroker(e.target.value)}>
            <option value="">Select broker</option>
            <option value="zerodha">Zerodha</option>
            <option value="angel">Angel One</option>
          </select>
        </div>
      </div>

      <div className="row grid-2">
        <div>
          <label className="label" htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            className="input"
            type="number"
            min="1"
            placeholder="Enter quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="orderType">Order Type</label>
          <select id="orderType" className="select" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
            {ORDER_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="row grid-2">
        <div>
          <label className="label" htmlFor="side">Side</label>
          <select id="side" className="select" value={'BUY'} disabled>
            <option value="BUY">Buy</option>
          </select>
        </div>
        <div className="hint-box" style={{ alignSelf: 'end' }}>
          You can prefill this form from the Positions tab.
        </div>
      </div>

      <div className="row">
        <div>
          <label className="label" htmlFor="price">Limit Price</label>
          <input
            id="price"
            className="input"
            type="number"
            min="0"
            step="0.05"
            placeholder="Required for limit orders"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>

      <button type="button" className="button" onClick={handlePlaceOrder} disabled={submitting}>
        {submitting ? 'Placing order...' : `Place Buy Order`}
      </button>

      {statusLocal && <div className={`status ${statusLocal.type}`}>{statusLocal.message}</div>}

      <ConfirmationDialog
        isOpen={showBuyConfirm}
        title="Confirm Buy Order"
        message={`You are about to place a buy order for ${quantity} share${Number(quantity) !== 1 ? 's' : ''} of ${stock.trim() || 'the selected stock'}.`}
        confirmLabel="Place Buy Order"
        cancelLabel="Cancel"
        onConfirm={confirmPlaceOrder}
        onCancel={() => setShowBuyConfirm(false)}
        totalOrders={1}
      />

      <p className="hint">
        Enter a stock name from the stock master table. For market orders, price is optional; for limit orders, price is required.
      </p>
    </div>
  )
}

const SingleOrderComponentForward = forwardRef(SingleOrderComponent)

/**
 * Main BuyOrder component with tabs for Single Order and Multi Order
 */
function BuyOrderComponent({ backendBase = '', setStatus }, ref) {
  const [activeTab, setActiveTab] = useState('single')
  const singleOrderRef = useRef(null)

  // Forward prepareTradeForm to SingleOrderComponent
  useImperativeHandle(ref, () => ({
    prepareTradeForm: (tradeSide, pos) => {
      setActiveTab('single')
      if (singleOrderRef.current) {
        singleOrderRef.current.prepareTradeForm(tradeSide, pos)
      }
    },
  }))

  return (
    <div>
      {/* Tab Navigation */}
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

      {/* Tab Content */}
      <div style={{ display: activeTab === 'single' ? 'block' : 'none' }}>
        <SingleOrderComponentForward ref={singleOrderRef} backendBase={backendBase} setStatus={setStatus} />
      </div>

      <div style={{ display: activeTab === 'multi' ? 'block' : 'none' }}>
        <MultiOrderTab backendBase={backendBase} setStatus={setStatus} />
      </div>
    </div>
  )
}

export default forwardRef(BuyOrderComponent)
