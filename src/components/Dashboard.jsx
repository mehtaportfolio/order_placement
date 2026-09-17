import React, { useState, useEffect } from 'react'
import '../App.css'
import { useNavigate } from 'react-router-dom'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)

export default function Dashboard({ 
  backendBase = '', 
  onNavigateToBuyOrder,
  onNavigateToSellOrder,
  onNavigateToPositions,
  positionsData = [],
  loadingPositions = false 
}) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState({
    totalPositions: 0,
    totalPL: 0,
    totalPLPercent: 0
  })
  const [dashboardPositions, setDashboardPositions] = useState([])
  const [loadingDashboardPositions, setLoadingDashboardPositions] = useState(false)
  const [accountStatuses, setAccountStatuses] = useState([])
  const [loadingAccountStatuses, setLoadingAccountStatuses] = useState(false)
  const [accountStatusError, setAccountStatusError] = useState(null)
  const [showSurveillanceModal, setShowSurveillanceModal] = useState(false)
  const [surveillanceRows, setSurveillanceRows] = useState([])
  const [surveillanceLoading, setSurveillanceLoading] = useState(false)
  const [surveillanceError, setSurveillanceError] = useState(null)
  const [surveillancePage, setSurveillancePage] = useState(1)
  const [surveillanceTypeFilter, setSurveillanceTypeFilter] = useState('ALL')
  const [surveillanceSearchTerm, setSurveillanceSearchTerm] = useState('')
  const pageSize = 5

  const positionSource = positionsData && positionsData.length > 0 ? positionsData : dashboardPositions

  useEffect(() => {
    if (positionSource && Array.isArray(positionSource)) {
      const totalCount = positionSource.length
      
      const totalPL = positionSource.reduce((sum, pos) => {
        return sum + (Number(pos.pnl) || 0)
      }, 0)

      const totalInvested = positionSource.reduce((sum, pos) => {
        return sum + (Number(pos.entry_price || 0) * Number(pos.quantity || 0))
      }, 0)

      const totalCurrentValue = positionSource.reduce((sum, pos) => {
        return sum + (Number(pos.ltp || pos.close_price || 0) * Number(pos.quantity || 0))
      }, 0)

      const totalPLPercent = totalInvested !== 0
        ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
        : 0

      setSummary({
        totalPositions: totalCount,
        totalPL: totalPL,
        totalPLPercent: totalPLPercent
      })
    }
  }, [positionSource])

  useEffect(() => {
    if (positionsData && positionsData.length > 0) {
      return
    }

    if (!backendBase || loadingDashboardPositions) {
      return
    }

    const fetchPositions = async () => {
      setLoadingDashboardPositions(true)
      try {
        const res = await fetch(`${backendBase}/api/buy-order/positions`)
        const data = await res.json()
        if (res.ok && Array.isArray(data.positions)) {
          setDashboardPositions(data.positions)
        }
      } catch (err) {
        console.warn('Dashboard position fetch failed:', err)
      } finally {
        setLoadingDashboardPositions(false)
      }
    }

    fetchPositions()
  }, [backendBase, positionsData, loadingDashboardPositions])

  const handleOpenSurveillanceModal = async () => {
    setShowSurveillanceModal(true)
    setSurveillanceError(null)

    if (!backendBase) {
      setSurveillanceError('Backend is not configured.')
      return
    }

    setSurveillanceLoading(true)

    try {
      const res = await fetch(`${backendBase}/api/surveillance/dashboard`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load surveillance data')
      }

      setSurveillanceRows(Array.isArray(data.rows) ? data.rows : [])
      setSurveillancePage(1)
    } catch (err) {
      setSurveillanceError(err.message || 'Unable to load surveillance data')
      setSurveillanceRows([])
    } finally {
      setSurveillanceLoading(false)
    }
  }

  const getFilteredSurveillanceRows = () => {
    return surveillanceRows.filter((row) => {
      const safeType = String(row.surveillance_type || '').toUpperCase()
      const stage = String(row.surveillance_stage || '').toUpperCase()
      const searchTerm = String(surveillanceSearchTerm || '').trim().toUpperCase()
      const isSeriesBE = safeType === 'SERIES' && stage !== 'EQ' && stage !== 'BZ'
      const isSeriesBZ = safeType === 'SERIES' && stage === 'BZ'
      const matchesType = surveillanceTypeFilter === 'ALL'
        || (surveillanceTypeFilter === 'Series-BE' && isSeriesBE)
        || (surveillanceTypeFilter === 'Series-BZ' && isSeriesBZ)
        || surveillanceTypeFilter === safeType

      const stockName = String(row.stock_name || '').toUpperCase()
      const companyName = String(row.stock_company_name || '').toUpperCase()
      const isin = String(row.isin || '').toUpperCase()
      const matchesSearch = !searchTerm || [stockName, companyName, isin].some((field) => field.includes(searchTerm))
      const matchesHoldings = row.in_current_holdings

      if (searchTerm) {
        return matchesType && matchesSearch && safeType !== 'ETF' && stage !== 'EQ'
      }

      return matchesType && matchesSearch && matchesHoldings && safeType !== 'ETF' && stage !== 'EQ'
    })
  }

  useEffect(() => {
    if (!backendBase) return

    const fetchAccountStatus = async () => {
      setLoadingAccountStatuses(true)
      setAccountStatusError(null)

      try {
        const res = await fetch(`${backendBase}/api/order/account-status`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Unable to load account status')
        }
        setAccountStatuses(Array.isArray(data.accounts) ? data.accounts : [])
      } catch (err) {
        setAccountStatusError(err.message || 'Failed to load account status')
      } finally {
        setLoadingAccountStatuses(false)
      }
    }

    fetchAccountStatus()
  }, [backendBase])

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <button
          type="button"
          onClick={handleOpenSurveillanceModal}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#f8fafc',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(16, 185, 129, 0.25)'
          }}
        >
          Stock Surveillance
        </button>
      </div>

      <div className="account-status-grid" style={{ marginBottom: 24 }}>
        {loadingAccountStatuses && (
          <div className="account-status-card account-status-full-width">
            Loading account health...
          </div>
        )}

        {!loadingAccountStatuses && accountStatusError && (
          <div className="account-status-card account-status-full-width" style={{ color: '#fecaca' }}>
            {accountStatusError}
          </div>
        )}

        {!loadingAccountStatuses && !accountStatusError && accountStatuses.length > 0 &&
          accountStatuses.map(({ account, broker, available }, index) => (
            <div key={`${account}-${broker}`} className="account-status-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>{account}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: available ? '#22c55e' : '#ef4444',
                      boxShadow: available ? '0 0 0 6px rgba(34,197,94,0.12)' : '0 0 0 6px rgba(239,68,68,0.15)',
                      display: 'inline-block'
                    }}
                  />
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                    ||
                  </span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Action Buttons */}
      <div className="row grid-2" style={{ marginBottom: 24, gap: 16 }}>
        <button
          className="button"
          onClick={onNavigateToBuyOrder}
          style={{
            background: 'linear-gradient(135deg, #2563eb, #1e40af)',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#ffffff',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #1e40af, #1e3a8a)'
            e.target.style.transform = 'translateY(-2px)'
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #2563eb, #1e40af)'
            e.target.style.transform = 'translateY(0)'
          }}
        >
          💳 Buy Order
        </button>

        <button
          className="button"
          onClick={() => navigate('/stock-details')}
          style={{
            gridColumn: '1',
            gridRow: '2',
            background: 'linear-gradient(135deg, #0f766e, #115e59)',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#ffffff',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #115e59, #134e4a)'
            e.target.style.transform = 'translateY(-2px)'
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #0f766e, #115e59)'
            e.target.style.transform = 'translateY(0)'
          }}
        >
          Stock Details
        </button>

        <button
          className="button"
          onClick={onNavigateToSellOrder}
          style={{
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#ffffff',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #b91c1c, #7f1d1d)'
            e.target.style.transform = 'translateY(-2px)'
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)'
            e.target.style.transform = 'translateY(0)'
          }}
        >
          📊 Sell Order
        </button>
      </div>

      {/* Summary Cards */}
      <div className="row grid-2" style={{ gap: 16 }}>
        {/* Total Positions Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1))',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onClick={onNavigateToPositions}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.15))'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1))'
          }}
        >
          <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>
            📈 Total Positions
          </p>
          <p style={{ margin: 0, color: '#e2e8f0', fontSize: '32px', fontWeight: 'bold' }}>
            {loadingPositions ? '...' : summary.totalPositions}
          </p>
        </div>

        {/* Total P/L Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)'
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))'
          }}
        >
          <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>
            💰 Total P/L
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <p style={{ margin: 0, color: '#e2e8f0', fontSize: '28px', fontWeight: 'bold' }}>
              {loadingPositions ? '...' : formatCurrency(summary.totalPL)}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '600',
                color: summary.totalPLPercent >= 0 ? '#10b981' : '#ef4444'
              }}
            >
              {loadingPositions ? '...' : `${summary.totalPLPercent.toFixed(2)}%`}
            </p>
          </div>
        </div>
      </div>

      {showSurveillanceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000
          }}
          onClick={() => setShowSurveillanceModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(100%, 1100px)',
              maxHeight: '85vh',
              overflow: 'auto',
              background: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
              padding: 24,
              color: '#e2e8f0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>
                  Stock Surveillance ({getFilteredSurveillanceRows().length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSurveillanceModal(false)}
                style={{
                  border: 'none',
                  background: 'rgba(148, 163, 184, 0.16)',
                  color: '#f8fafc',
                  borderRadius: '999px',
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: '13px' }}>
                <span>Type</span>
                <select
                  value={surveillanceTypeFilter}
                  onChange={(e) => {
                    setSurveillanceTypeFilter(e.target.value)
                    setSurveillancePage(1)
                  }}
                  style={{
                    minWidth: 160,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.24)',
                    background: '#0f172a',
                    color: '#f8fafc'
                  }}
                >
                  <option value="ALL">All</option>
                  <option value="ASM">ASM</option>
                  <option value="ESM">ESM</option>
                  <option value="GSM">GSM</option>
                  <option value="Series-BE">Series-BE</option>
                  <option value="Series-BZ">Series-BZ</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: '13px' }}>
                <span>Stock</span>
                <input
                  value={surveillanceSearchTerm}
                  onChange={(e) => {
                    setSurveillanceSearchTerm(e.target.value)
                    setSurveillancePage(1)
                  }}
                  placeholder="Search stock"
                  style={{
                    minWidth: 200,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.24)',
                    background: '#0f172a',
                    color: '#f8fafc'
                  }}
                />
              </label>
            </div>

            {surveillanceLoading ? (
              <p style={{ color: '#cbd5e1' }}>Loading surveillance data...</p>
            ) : surveillanceError ? (
              <p style={{ color: '#fda4af' }}>{surveillanceError}</p>
            ) : (() => {
              const filteredRows = getFilteredSurveillanceRows()
              const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
              const safePage = Math.min(surveillancePage, totalPages)
              const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)

              if (filteredRows.length === 0) {
                return <p style={{ color: '#cbd5e1' }}>No matching holdings found.</p>
              }

              return (
                <div>
                  <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ color: '#cbd5e1', textAlign: 'left', borderBottom: '1px solid rgba(148, 163, 184, 0.22)' }}>
                          <th style={{ padding: '10px 8px', width: '60px' }}>#</th>
                          <th style={{ padding: '10px 8px' }}>Stock</th>
                          <th style={{ padding: '10px 8px' }}>Type</th>
                          <th style={{ padding: '10px 8px' }}>Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map((row, index) => (
                          <tr key={`${row.stock_name}-${row.surveillance_type}-${index}`} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.14)' }}>
                            <td style={{ padding: '10px 8px', color: '#94a3b8', fontWeight: 600 }}>{(safePage - 1) * pageSize + index + 1}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.stock_name}</td>
                            <td style={{ padding: '10px 8px' }}>{row.surveillance_type || '-'}</td>
                            <td style={{ padding: '10px 8px' }}>{row.surveillance_stage || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, color: '#cbd5e1', fontSize: '13px' }}>
                    <span>Page {safePage} of {totalPages}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setSurveillancePage((page) => Math.max(1, page - 1))}
                        disabled={safePage === 1}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(148, 163, 184, 0.24)',
                          background: safePage === 1 ? 'rgba(30,41,59,0.8)' : '#1d4ed8',
                          color: '#f8fafc',
                          cursor: safePage === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setSurveillancePage((page) => Math.min(totalPages, page + 1))}
                        disabled={safePage === totalPages}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(148, 163, 184, 0.24)',
                          background: safePage === totalPages ? 'rgba(30,41,59,0.8)' : '#1d4ed8',
                          color: '#f8fafc',
                          cursor: safePage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loadingPositions && summary.totalPositions === 0 && (
        <div
          style={{
            marginTop: 24,
            padding: 24,
            textAlign: 'center',
            background: 'rgba(100, 116, 139, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(100, 116, 139, 0.2)'
          }}
        >
          <p style={{ color: '#94a3b8', marginBottom: 12 }}>No open positions yet</p>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Click "Buy Order" to create your first position
          </p>
        </div>
      )}
    </div>
  )
}
