import React, { useState, useEffect } from 'react'
import '../App.css'

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
  positionsData = [],
  loadingPositions = false 
}) {
  const [summary, setSummary] = useState({
    totalPositions: 0,
    totalPL: 0,
    totalPLPercent: 0
  })
  const [dashboardPositions, setDashboardPositions] = useState([])
  const [loadingDashboardPositions, setLoadingDashboardPositions] = useState(false)

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

  return (
    <div className="card">
      <h1>Dashboard</h1>

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

      {/* Empty State */}
      {!loadingPositions && summary.totalPositions === 0 && (
        <div
          style={{
            marginTop: 32,
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
