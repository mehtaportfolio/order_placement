import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../App.css'
import ConfirmationDialog from './ConfirmationDialog'

const BROKERS = [
  { value: '', label: 'All Brokers' },
  { value: 'zerodha', label: 'Zerodha' },
  { value: 'angel', label: 'Angel One' },
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

export default function Positions({ backendBase = '', onPrepareTrade, setStatus, onPositionsUpdate }) {
  const [positions, setPositions] = useState([])
  const [positionBroker, setPositionBroker] = useState('')
  const [positionAccount, setPositionAccount] = useState('')
  const [loadingPositions, setLoadingPositions] = useState(false)
  const isFetchingRef = useRef(false)

  const loadPositionsFull = useCallback(async () => {
    setLoadingPositions(true)
    setStatus && setStatus(null)
    try {
      const res = await fetch(`${backendBase}/api/buy-order/positions`)
      const data = await res.json()
      if (res.ok) {
        const positions = data.positions || []
        setPositions(positions)
      } else {
        setStatus && setStatus({ type: 'error', message: data.error || 'Failed to load positions' })
      }
    } catch (err) {
      setStatus && setStatus({ type: 'error', message: err.message || 'Failed to load positions' })
    } finally {
      setLoadingPositions(false)
    }
  }, [backendBase, setStatus])

  const pollPositionsAndMerge = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      const res = await fetch(`${backendBase}/api/buy-order/positions`)
      const data = await res.json()
      if (!res.ok) return
      const fetched = data.positions || []

      setPositions((prev) => {
        if (!prev || prev.length === 0) return fetched

        const getId = (p) => p.id ?? p.position_id ?? `${p.broker}::${p.account}::${p.symbol}::${p.entry_price}`
        const prevIds = new Set(prev.map(getId))
        const fetchedIds = new Set(fetched.map(getId))

        for (const id of fetchedIds) {
          if (!prevIds.has(id)) {
            return fetched
          }
        }

        const fetchedById = new Map(fetched.map((f) => [getId(f), f]))
        return prev.map((p) => {
          const id = getId(p)
          const f = fetchedById.get(id)
          if (!f) return p
          const ltp = f.ltp ?? f.last_price ?? p.ltp
          const pnl = f.pnl ?? p.pnl
          const pnl_percent = f.pnl_percent ?? p.pnl_percent
          if (ltp === p.ltp && pnl === p.pnl && pnl_percent === p.pnl_percent) return p
          return { ...p, ltp, pnl, pnl_percent }
        })
      })
    } catch (err) {
      // swallow polling errors
    } finally {
      isFetchingRef.current = false
    }
  }, [backendBase])

  useEffect(() => {
    // load and start polling
    loadPositionsFull()
    const id = setInterval(() => pollPositionsAndMerge(), 3000)
    return () => clearInterval(id)
  }, [loadPositionsFull, pollPositionsAndMerge])

  const filteredPositions = useMemo(() => {
    let data = positions
    if (positionBroker) {
      data = data.filter((pos) => pos.broker.toLowerCase() === positionBroker.toLowerCase())
    }
    if (positionAccount) {
      data = data.filter((pos) => pos.account.toLowerCase() === positionAccount.toLowerCase())
    }
    return data
  }, [positions, positionBroker, positionAccount])

  const positionsSummary = useMemo(() => {
    const source = filteredPositions
    const totalPnl = source.reduce((sum, pos) => sum + (Number(pos.pnl) || 0), 0)
    const totalInvested = source.reduce((sum, pos) => sum + (Number(pos.entry_price || 0) * Number(pos.quantity || 0)), 0)
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
    return {
      totalPnl,
      totalPnlPercent,
      positionCount: source.length,
    }
  }, [filteredPositions])

  const { totalPnl, totalPnlPercent, positionCount } = positionsSummary
  const totalPnlClass = totalPnl > 0 ? 'pnl-positive' : totalPnl < 0 ? 'pnl-negative' : 'pnl-neutral'
  const totalPnlPctClass = totalPnlPercent > 0 ? 'pnl-positive' : totalPnlPercent < 0 ? 'pnl-negative' : 'pnl-neutral'

  const [sellingPositionId, setSellingPositionId] = useState(null)
  const [confirmSellPosition, setConfirmSellPosition] = useState(null)
  const [showSellConfirm, setShowSellConfirm] = useState(false)

  const normalizeBroker = (broker) => {
    if (!broker) return ''
    const normalized = broker.toString().trim().toLowerCase().replace(/\s+/g, '')
    if (normalized.includes('angel')) return 'angel'
    if (normalized.includes('zerodha')) return 'zerodha'
    return normalized
  }

  const placeSellOrderForPosition = async (pos) => {
    const broker = normalizeBroker(pos.broker)
    const account_id = pos.account || pos.account_id || ''
    const symbol = pos.symbol || pos.stock_name || ''
    const quantity = Number(pos.quantity || 0)
    const transaction_id = pos.transaction_id || pos.id || null

    if (!broker || !account_id || !symbol || !quantity) {
      setStatus && setStatus({ type: 'error', message: 'Invalid position data for sell order.' })
      return
    }

    setSellingPositionId(pos.id || `${broker}-${account_id}-${symbol}`)
    setStatus && setStatus({ type: 'loading', message: 'Placing sell order...' })

    try {
      const res = await fetch(`${backendBase}/api/order/place-sell-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker,
          account_id,
          symbol,
          quantity,
          price: null,
          transaction_id,
          order_type: 'MARKET',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus && setStatus({ type: 'success', message: `Sell order placed successfully. Order ID: ${data.order_id || 'N/A'}` })
        loadPositionsFull()
      } else {
        setStatus && setStatus({ type: 'error', message: data.error || 'Failed to place sell order.' })
      }
    } catch (err) {
      setStatus && setStatus({ type: 'error', message: err.message || 'Network error while placing sell order.' })
    } finally {
      setSellingPositionId(null)
    }
  }

  const confirmAndPlaceSellOrder = (pos) => {
    setConfirmSellPosition(pos)
    setShowSellConfirm(true)
  }

  const handleConfirmSellOrder = () => {
    if (!confirmSellPosition) return
    placeSellOrderForPosition(confirmSellPosition)
    setConfirmSellPosition(null)
    setShowSellConfirm(false)
  }

  const handleCancelSellConfirm = () => {
    setConfirmSellPosition(null)
    setShowSellConfirm(false)
  }

  const prepareTradeForm = (tradeSide, pos) => {
    if (tradeSide === 'SELL') {
      confirmAndPlaceSellOrder(pos)
      return
    }
    if (onPrepareTrade) onPrepareTrade(tradeSide, pos)
  }

  return (
    <div className="card">
      <div className="positions-header">
        <div>
          <h1>Open Positions</h1>
         
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="save-button"
            onClick={async () => {
              try {
                setStatus && setStatus({ type: 'loading', message: 'Saving positions...' });
                const res = await fetch(`${backendBase}/api/buy-order/save-positions`, { method: 'POST' });
                const data = await res.json();
                if (res.ok && data.inserted > 0) {
                  let message = `Saved ${data.inserted} ${data.inserted === 1 ? 'transaction' : 'transactions'}`;
                  if (data.duplicates > 0) {
                    message += ` (${data.duplicates} duplicate${data.duplicates === 1 ? '' : 's'} skipped)`;
                  }
                  setStatus && setStatus({ type: 'success', message });
                } else if (res.ok && data.inserted === 0 && data.duplicates > 0) {
                  setStatus && setStatus({ type: 'loading', message: `All ${data.duplicates} position${data.duplicates === 1 ? '' : 's'} already exist` });
                } else if (res.ok && data.inserted === 0) {
                  setStatus && setStatus({ type: 'loading', message: 'No new positions to save' });
                } else {
                  setStatus && setStatus({ type: 'error', message: data.error || 'Save failed' });
                }
              } catch (err) {
                setStatus && setStatus({ type: 'error', message: err.message || 'Save failed' });
              }
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="save-button"
            onClick={async () => {
              setStatus && setStatus({ type: 'loading', message: 'Syncing and saving open positions...' });
              try {
                const res = await fetch(`${backendBase}/api/buy-order/sync-positions`, { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                  const summary = data.summary?.map((item) => `${item.broker}:${item.account} ${item.success ? 'OK' : 'FAIL'} (${item.inserted || 0} ins, ${item.updated || 0} upd)`).join('; ');
                  const inserted = data.save?.inserted ?? data.inserted ?? 0;
                  const duplicates = data.save?.duplicates ?? data.duplicates ?? 0;
                  const saveMessage = inserted > 0
                    ? `Saved ${inserted} transaction${inserted === 1 ? '' : 's'}`
                    : duplicates > 0
                      ? `All ${duplicates} position${duplicates === 1 ? '' : 's'} were already present`
                      : 'No new transactions were created';
                  setStatus && setStatus({ type: 'success', message: `${data.message || 'Sync complete.'} ${summary ? `| ${summary}` : ''} | ${saveMessage}` });
                  loadPositionsFull();
                } else {
                  setStatus && setStatus({ type: 'error', message: data.error || 'Sync failed' });
                }
              } catch (err) {
                setStatus && setStatus({ type: 'error', message: err.message || 'Sync failed' });
              }
            }}
          >
            Sync
          </button>
          <button type="button" className="refresh-button" onClick={loadPositionsFull} disabled={loadingPositions}>
            {loadingPositions ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="broker-subtabs" style={{ marginTop: 12, marginBottom: 12 }}>
        <button className={`tab-subbtn ${positionBroker === '' ? 'active' : ''}`} onClick={() => setPositionBroker('')} style={{ marginRight: 8 }}>All</button>
        <button className={`tab-subbtn ${positionBroker === 'zerodha' ? 'active' : ''}`} onClick={() => setPositionBroker('zerodha')} style={{ marginRight: 8 }}>Zerodha</button>
        <button className={`tab-subbtn ${positionBroker === 'angel' ? 'active' : ''}`} onClick={() => setPositionBroker('angel')}>Angel One</button>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">Total Positions</div>
          <div className="summary-value">{positionCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total P/L</div>
          <div className="summary-value-combined">
            <div className={`summary-value ${totalPnlClass}`}>{formatCurrency(totalPnl)}</div>
            <span className={`summary-value-pct ${totalPnlPctClass}`}>({totalPnlPercent.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      <div className="row grid-2" style={{ marginBottom: 16 }}>
        <div>
          <label className="label" htmlFor="positionFilter">Filter by Broker</label>
          <select id="positionFilter" className="select" value={positionBroker} onChange={(e) => setPositionBroker(e.target.value)}>
            {BROKERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="positionAccount">Filter by Account</label>
          <select id="positionAccount" className="select" value={positionAccount} onChange={(e) => setPositionAccount(e.target.value)}>
            {ACCOUNTS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="positions-table">
          <thead>
            <tr>
              {positionBroker === '' && <th>Broker</th>}
              <th>Account</th>
              <th>Stock</th>
              <th>Qty</th>
              <th>Entry Price</th>
              <th>LTP</th>
              <th>PnL</th>
              <th>PnL %</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingPositions ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  <div className="spinner" />
                  <p>Loading positions...</p>
                </td>
              </tr>
            ) : filteredPositions.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  {positions.length === 0 ? 'No open positions found.' : 'No positions match the filter.'}
                </td>
              </tr>
            ) : (
              filteredPositions.map((pos, index) => {
                const pnlClass = pos.pnl > 0 ? 'pnl-positive' : pos.pnl < 0 ? 'pnl-negative' : 'pnl-neutral'
                return (
                  <tr key={`${pos.symbol}-${index}`}>
                    {positionBroker === '' && <td>{pos.broker}</td>}
                    <td>{pos.account}</td>
                    <td>{pos.stock_name}</td>
                    <td>{pos.quantity}</td>
                    <td>{formatCurrency(pos.entry_price)}</td>
                    <td>{formatCurrency(pos.ltp)}</td>
                    <td className={pnlClass}>{formatCurrency(pos.pnl)}</td>
                    <td className={pnlClass}>{pos.pnl_percent}%</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => prepareTradeForm('BUY', pos)}
                        title="Add"
                        aria-label={`Add ${pos.stock_name || pos.symbol || 'position'}`}
                      >
                        ➕
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => prepareTradeForm('SELL', pos)}
                        title="Sell"
                        aria-label={`Sell ${pos.stock_name || pos.symbol || 'position'}`}
                        disabled={sellingPositionId === (pos.id || `${normalizeBroker(pos.broker)}-${pos.account || pos.account_id || ''}-${pos.symbol || pos.stock_name || ''}`)}
                      >
                        {sellingPositionId === (pos.id || `${normalizeBroker(pos.broker)}-${pos.account || pos.account_id || ''}-${pos.symbol || pos.stock_name || ''}`) ? '…' : '⤴'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {confirmSellPosition && (
        <ConfirmationDialog
          isOpen={showSellConfirm}
          title="Confirm Sell Order"
          message={`You are about to sell ${Number(confirmSellPosition.quantity)} share${Number(confirmSellPosition.quantity) !== 1 ? 's' : ''} of ${confirmSellPosition.symbol || confirmSellPosition.stock_name || ''}.`}
          confirmLabel="Place Sell Order"
          cancelLabel="Cancel"
          onConfirm={handleConfirmSellOrder}
          onCancel={handleCancelSellConfirm}
          totalOrders={1}
        />
      )}
    </div>
  )
}
