import { useState } from 'react'

export default function SettingsModal({
  isOpen,
  onClose,
  biometricEnabled,
  biometricAvailable,
  isAuthenticating,
  enableBiometric,
  handleDisableBiometric,
  onOpenChangePassword,
  backendBase,
  setStatus
}) {
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [changeCurrent, setChangeCurrent] = useState('')
  const [changeNew, setChangeNew] = useState('')

  const handleChangeMasterPassword = async () => {
    if (!changeCurrent || !changeNew) {
      setStatus({ type: 'error', message: 'Provide current and new password' })
      return
    }
    try {
      const email = 'mehtaportfolio28@gmail.com'
      const res = await fetch(`${backendBase}/api/auth/update-master-password-unauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword: changeCurrent, newPassword: changeNew })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus({ type: 'success', message: 'Master password updated' })
        setChangeCurrent('')
        setChangeNew('')
        setShowChangePasswordModal(false)
      } else {
        setStatus({ type: 'error', message: data.message || 'Failed to update master password' })
      }
    } catch (err) {
      console.error('Change master password', err)
      setStatus({ type: 'error', message: 'Network error updating master password' })
    }
  }

  const closeChangePasswordModal = () => {
    setShowChangePasswordModal(false)
    setChangeCurrent('')
    setChangeNew('')
  }

  if (!isOpen) return null

  return (
    <>
      {/* Settings Modal */}
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Settings</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="label" style={{ margin: 0 }}>Biometric Authentication</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>{biometricEnabled ? 'Enabled' : 'Disabled'}</div>
                {biometricEnabled ? (
                  <button className="button" onClick={handleDisableBiometric} style={{ width: 'fit-content', padding: '4px 12px', fontSize: '16px' }}>Turn Off</button>
                ) : (
                  <button className="button" onClick={enableBiometric} disabled={isAuthenticating} style={{ width: 'fit-content', padding: '4px 12px', fontSize: '16px' }}>{isAuthenticating ? 'Registering...' : 'Turn On'}</button>
                )}
              </div>
            </div>

            <hr />

            <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="label" style={{ margin: 0 }}>Change Master Password</label>
              <button className="button" onClick={() => setShowChangePasswordModal(true)} style={{ width: 'fit-content', padding: '4px 12px', fontSize: '20px' }}>Yes</button>
            </div>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Change Master Password</h2>
              <button className="modal-close" onClick={closeChangePasswordModal}>×</button>
            </div>
            <div className="modal-body">
              <input className="input" type="password" placeholder="Current password" value={changeCurrent} onChange={(e) => setChangeCurrent(e.target.value)} />
              <input className="input" type="password" placeholder="New password" value={changeNew} onChange={(e) => setChangeNew(e.target.value)} />
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="button" onClick={handleChangeMasterPassword}>Change</button>
                <button className="button" onClick={closeChangePasswordModal} style={{ backgroundColor: '#6b7280' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
