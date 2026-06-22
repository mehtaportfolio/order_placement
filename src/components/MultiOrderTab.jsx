import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import { useStockSearch } from '../hooks/useStockSearch'
import { useMultiOrderTable } from '../hooks/useMultiOrderTable'
import MultiOrderTable from './MultiOrderTable'
import ConfirmationDialog from './ConfirmationDialog'

const ACCOUNTS = [
  { value: '', label: 'Select account' },
  { value: 'PM', label: 'PM' },
  { value: 'PDM', label: 'PDM' },
  { value: 'PSM', label: 'PSM' },
]

const BROKERS = [
  { value: '', label: 'Select broker' },
  { value: 'zerodha', label: 'Zerodha' },
  { value: 'angel', label: 'Angel One' },
]

const ORDER_TYPES = [
  { value: 'LIMIT', label: 'Limit' },
  { value: 'MARKET', label: 'Market' },
]

/**
 * Multi-Order Tab Component
 * Allows users to add multiple orders and place them in bulk
 */
function MultiOrderTab({ backendBase = '', setStatus }) {
  const { stocks, loading: stocksLoading, searchTerm, setSearchTerm, suggestions, loadStockMaster } = useStockSearch(backendBase)
  const {
    orders,
    addOrder,
    updateOrder,
    deleteOrder,
    duplicateOrder,
    clearOrders,
    getBrokerWiseCount,
    orderCount,
  } = useMultiOrderTable()

  const [stock, setStock] = useState('')
  const [broker, setBroker] = useState('')
  const [account, setAccount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [orderType, setOrderType] = useState('LIMIT')
  const [price, setPrice] = useState('')

  const navigate = useNavigate()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusLocal, setStatusLocal] = useState(null)

  const stockInputRef = useRef(null)

  // Load stock master on component mount
  useEffect(() => {
    loadStockMaster()
  }, [loadStockMaster])

  // Auto-hide status after 4 seconds
  useEffect(() => {
    if (!statusLocal) return
    const timer = setTimeout(() => setStatusLocal(null), 4000)
    return () => clearTimeout(timer)
  }, [statusLocal])

  // Update search term when stock input changes
  const handleStockChange = (e) => {
    setStock(e.target.value)
    setSearchTerm(e.target.value)
  }

  // Select a stock from suggestions
  const handleSelectStock = (stockName) => {
    setStock(stockName)
    setSearchTerm('')
  }

  // Validate form before adding order
  const validateForm = () => {
    if (!stock.trim()) return 'Stock is required.'
    if (!broker) return 'Broker is required.'
    if (!account) return 'Account is required.'
    if (!quantity || Number(quantity) <= 0) return 'Quantity must be greater than zero.'
    if (orderType === 'LIMIT' && (!price || Number(price) <= 0)) return 'Price is required for limit orders.'
    return null
  }

  // Add order to table
  const handleAddOrder = () => {
    const error = validateForm()
    if (error) {
      setStatusLocal({ type: 'error', message: error })
      return
    }

    const newOrder = {
      stock: stock.trim(),
      broker,
      account,
      quantity: Number(quantity),
      orderType,
      price: orderType === 'LIMIT' ? Number(price) : null,
    }

    addOrder(newOrder)
    setStatusLocal({ type: 'success', message: 'Order added to table' })

    // Reset form for next order
    setStock('')
    setSearchTerm('')
    setBroker('')
    setAccount('')
    setQuantity('')
    setOrderType('LIMIT')
    setPrice('')

    if (stockInputRef.current) {
      stockInputRef.current.focus()
    }
  }

  // Handle place orders (show confirmation)
  const handlePlaceOrders = () => {
    if (orderCount === 0) {
      setStatusLocal({ type: 'error', message: 'Add at least one order before placing.' })
      return
    }
    setShowConfirmation(true)
  }

  // Confirm and submit all orders
  const handleConfirmPlaceOrders = async () => {
    setShowConfirmation(false)
    setSubmitting(true)
    setStatusLocal(null)

    try {
      const response = await fetch(`${backendBase}/api/orders/multi-buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: orders.map((order) => ({
            account_name: order.account,
            broker: order.broker,
            symbol: order.stock,
            quantity: order.quantity,
            order_type: order.orderType,
            transaction_type: 'BUY',
            price: order.price,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatusLocal({
          type: 'error',
          message: data.error || 'Failed to place orders.',
        })
        return
      }

      // Show success summary
      const summary = data.summary || {}
      const successCount = Object.values(summary).reduce((sum, counts) => sum + (counts.success || 0), 0)
      const failureCount = Object.values(summary).reduce((sum, counts) => sum + (counts.failed || 0), 0)

      let message = `Orders submitted: ${successCount} successful`
      if (failureCount > 0) {
        message += `, ${failureCount} failed`
      }

      setStatusLocal({ type: 'success', message })

      // Clear orders after successful submission
      clearOrders()
    } catch (err) {
      setStatusLocal({
        type: 'error',
        message: err.message || 'Network error while placing orders.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const brokerWiseCounts = getBrokerWiseCount()

  return (
    <div className="card">
      <h2>Multi-Buy-Orders</h2>

      {/* Stock Search Section */}
      <div className="row">
        <div>
          <label className="label" htmlFor="multi-stock">Search Stock</label>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            <div className="dropdown" style={{ flex: 1 }}>
              <input
                ref={stockInputRef}
                id="multi-stock"
                className="input"
                value={stock}
                onChange={handleStockChange}
                placeholder="Type stock name..."
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <div className="suggestions">
                  {suggestions.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      type="button"
                      className="suggestion"
                      onClick={() => handleSelectStock(item.name)}
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
              aria-label="Add new stock"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Show remaining fields only after stock is selected */}
      {stock && (
        <>
          {/* Broker and Account Selection */}
          <div className="row grid-2">
            <div>
              <label className="label" htmlFor="multi-broker">Broker</label>
              <select
                id="multi-broker"
                className="select"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
              >
                {BROKERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="multi-account">Account</label>
              <select
                id="multi-account"
                className="select"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                {ACCOUNTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity and Order Type */}
          <div className="row grid-2">
            <div>
              <label className="label" htmlFor="multi-quantity">Quantity</label>
              <input
                id="multi-quantity"
                className="input"
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="multi-order-type">Order Type</label>
              <select
                id="multi-order-type"
                className="select"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
              >
                {ORDER_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Limit Price - Only show for LIMIT orders */}
          {orderType === 'LIMIT' && (
            <div className="row">
              <div>
                <label className="label" htmlFor="multi-price">Limit Price</label>
                <input
                  id="multi-price"
                  className="input"
                  type="number"
                  min="0"
                  step="0.05"
                  placeholder="Enter limit price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Add Order Button */}
          <button
            type="button"
            className="button"
            onClick={handleAddOrder}
            style={{ marginTop: '12px', marginBottom: '20px' }}
          >
            + Add Order to Table
          </button>
        </>
      )}

      {/* Place Orders Button */}
      {orders.length > 0 && (
        <button
          type="button"
          className="button"
          onClick={handlePlaceOrders}
          disabled={orderCount === 0 || submitting}
          style={{
            marginTop: '20px',
            marginBottom: '20px',
            backgroundColor: orderCount === 0 ? '#ccc' : '#4CAF50',
            cursor: orderCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Placing orders...' : `PLACE ORDERS (${orderCount})`}
        </button>
      )}

      {/* Multi-Order Table - Below the button */}
      {orders.length > 0 && (
        <MultiOrderTable
          orders={orders}
          onUpdate={updateOrder}
          onDelete={deleteOrder}
          onDuplicate={duplicateOrder}
          backendBase={backendBase}
        />
      )}

      {/* Status Message */}
      {statusLocal && (
        <div className={`status ${statusLocal.type}`} style={{ marginTop: '12px' }}>
          {statusLocal.message}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={handleConfirmPlaceOrders}
        onCancel={() => setShowConfirmation(false)}
        brokerWiseCounts={brokerWiseCounts}
        totalOrders={orderCount}
      />

      <p className="hint" style={{ marginTop: '16px' }}>
        Add multiple orders to the table, then place them all at once. You can edit or duplicate orders before submission.
      </p>
    </div>
  )
}

export default MultiOrderTab
