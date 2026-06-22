import { useEffect, useState, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { FiSettings } from 'react-icons/fi'
import './App.css'
import Dashboard from './components/Dashboard'
import BuyOrder from './components/BuyOrder'
import SellOrder from './components/SellOrder'
import Positions from './components/Positions'
import BottomBar from './components/BottomBar'
import SettingsModal from './components/SettingsModal'
import { useBiometricAuth } from './hooks/useBiometricAuth.js'
import AddStockPage from './pages/AddStockPage.jsx'

function App() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [status, setStatus] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [positionsData, setPositionsData] = useState([])
  const [loadingPositions, setLoadingPositions] = useState(false)

  const backendBase = import.meta.env.VITE_BACKEND_URL || ''
  const buyRef = useRef(null)

  const {
    biometricAvailable,
    biometricEnabled,
    isAuthenticating,
    registerBiometric,
    authenticateWithBiometric,
    disableBiometric,
  } = useBiometricAuth()

  useEffect(() => {
    if (!authenticated) {
      const tryBiometric = async () => {
        try {
          if (biometricEnabled) {
            const result = await authenticateWithBiometric('mehtaportfolio28@gmail.com')
            if (result?.success) {
              setAuthenticated(true)
              setShowPasswordModal(false)
              setAuthLoading(false)
              return
            }
          }
        } catch (error) {
          console.warn('Biometric auto-login failed:', error)
        }
        setAuthLoading(false)
        setShowPasswordModal(true)
      }

      tryBiometric()
    }
  }, [authenticated, biometricEnabled, authenticateWithBiometric])

  useEffect(() => {
    if (!status) return undefined
    const timer = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (location.pathname === '/buy-order' || location.state?.refresh) {
      setActiveTab('buy-order')
    } else if (location.pathname === '/sell-order') {
      setActiveTab('sell-order')
    } else if (location.pathname === '/positions') {
      setActiveTab('positions')
    } else if (location.pathname === '/') {
      setActiveTab('dashboard')
    }
  }, [location.pathname, location.state])

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    setStatus(null)
  }

  const handleNavigateToBuyOrder = () => {
    setActiveTab('buy-order')
  }

  const handleNavigateToSellOrder = () => {
    setActiveTab('sell-order')
  }

  const handlePrepareTrade = (side, pos) => {
    if (side === 'SELL') {
      setActiveTab('sell-order')
      return
    }

    setActiveTab('buy-order')
    setTimeout(() => {
      buyRef.current?.prepareTradeForm(side, pos)
    }, 50)
  }

  const handlePositionsUpdate = (positions) => {
    setPositionsData(positions || [])
    setLoadingPositions(false)
  }

  const verifyMasterPassword = async (password) => {
    try {
      const res = await fetch(`${backendBase}/api/auth/user-details?email=${encodeURIComponent('mehtaportfolio28@gmail.com')}`)
      const data = await res.json()
      if (!res.ok) return false
      const expected = data.master_password || data.user_password
      return expected === password
    } catch (err) {
      console.error('Error verifying master password', err)
      return false
    }
  }

  const handlePasswordSubmit = async () => {
    setAuthLoading(true)
    const ok = await verifyMasterPassword(passwordInput)
    if (ok) {
      setAuthenticated(true)
      setShowPasswordModal(false)
      setStatus({ type: 'success', message: 'Authenticated successfully' })
    } else {
      setStatus({ type: 'error', message: 'Incorrect master password' })
    }
    setAuthLoading(false)
  }

  const enableBiometric = async () => {
    try {
      await registerBiometric('mehtaportfolio28@gmail.com', passwordInput)
      setStatus({ type: 'success', message: 'Biometric enabled successfully' })
      setShowSettingsModal(false)
    } catch (error) {
      console.error('Enable biometric error:', error)
      setStatus({ type: 'error', message: error.message || 'Failed to enable biometric' })
    }
  }

  const handleDisableBiometric = () => {
    disableBiometric('mehtaportfolio28@gmail.com')
    setStatus({ type: 'success', message: 'Biometric disabled' })
  }

  return (
    <div className="app-shell">
      <main className="page">
        <header style={{ marginBottom: 16, position: 'relative' }}>
          <h1>Order placement app</h1>
          <FiSettings
            size={20}
            color="#FFFFFF"
            onClick={() => setShowSettingsModal(true)}
            style={{ position: 'absolute', right: 8, top: 8, cursor: 'pointer' }}
          />
        </header>

        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          biometricEnabled={biometricEnabled}
          biometricAvailable={biometricAvailable}
          isAuthenticating={isAuthenticating}
          enableBiometric={enableBiometric}
          handleDisableBiometric={handleDisableBiometric}
          backendBase={backendBase}
          setStatus={setStatus}
        />

        {showPasswordModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Enter Master Password</h2>
                <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePasswordSubmit();
                }}
                className="modal-body"
              >
                <input
                  className="input"
                  type="password"
                  placeholder="Master password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                <div style={{ marginTop: 12 }}>
                  <button type="submit" className="button" disabled={authLoading}>
                    {authLoading ? 'Checking...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {status && <div className={`status ${status.type}`}>{status.message}</div>}

        {authenticated ? (
          <Routes>
            <Route path="/add-stock" element={<AddStockPage setStatus={setStatus} />} />
            <Route
              path="/buy-order"
              element={
                <>
                  <div className={`tab-content ${activeTab === 'dashboard' ? 'active' : ''}`}>
                    <Dashboard
                      backendBase={backendBase}
                      onNavigateToBuyOrder={handleNavigateToBuyOrder}
                      onNavigateToSellOrder={handleNavigateToSellOrder}
                      positionsData={positionsData}
                      loadingPositions={loadingPositions}
                    />
                  </div>

                  <div className={`tab-content ${activeTab === 'buy-order' ? 'active' : ''}`}>
                    <BuyOrder ref={buyRef} backendBase={backendBase} setStatus={setStatus} />
                  </div>

                  <div className={`tab-content ${activeTab === 'sell-order' ? 'active' : ''}`}>
                    <SellOrder backendBase={backendBase} setStatus={setStatus} />
                  </div>

                  <div className={`tab-content ${activeTab === 'positions' ? 'active' : ''}`}>
                    <Positions
                      backendBase={backendBase}
                      onPrepareTrade={handlePrepareTrade}
                      setStatus={setStatus}
                      onPositionsUpdate={handlePositionsUpdate}
                    />
                  </div>

                  <BottomBar activeTab={activeTab} onSwitch={handleTabSwitch} />
                </>
              }
            />
            <Route
              path="/*"
              element={
                <>
                  <div className={`tab-content ${activeTab === 'dashboard' ? 'active' : ''}`}>
                    <Dashboard
                      backendBase={backendBase}
                      onNavigateToBuyOrder={handleNavigateToBuyOrder}
                      onNavigateToSellOrder={handleNavigateToSellOrder}
                      positionsData={positionsData}
                      loadingPositions={loadingPositions}
                    />
                  </div>

                  <div className={`tab-content ${activeTab === 'buy-order' ? 'active' : ''}`}>
                    <BuyOrder ref={buyRef} backendBase={backendBase} setStatus={setStatus} />
                  </div>

                  <div className={`tab-content ${activeTab === 'sell-order' ? 'active' : ''}`}>
                    <SellOrder backendBase={backendBase} setStatus={setStatus} />
                  </div>

                  <div className={`tab-content ${activeTab === 'positions' ? 'active' : ''}`}>
                    <Positions
                      backendBase={backendBase}
                      onPrepareTrade={handlePrepareTrade}
                      setStatus={setStatus}
                      onPositionsUpdate={handlePositionsUpdate}
                    />
                  </div>

                  <BottomBar activeTab={activeTab} onSwitch={handleTabSwitch} />
                </>
              }
            />
          </Routes>
        ) : (
          <div style={{ padding: 20 }}>
            <p>Please authenticate to continue.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
