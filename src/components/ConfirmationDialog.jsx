import React from 'react'
import '../App.css'

/**
 * Confirmation dialog for multi-order placement
 * Shows broker-wise order summary
 */
function ConfirmationDialog({
  isOpen,
  onConfirm,
  onCancel,
  brokerWiseCounts = {},
  totalOrders = 0,
  title = 'Confirm Multi-Order Placement',
  confirmLabel = 'Confirm & Place Orders',
  cancelLabel = 'Cancel',
  message,
}) {
  if (!isOpen) return null

  const brokerList = Object.entries(brokerWiseCounts)
    .sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="modal-overlay">
      <div className="modal-content confirmation-dialog" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body" style={{ textAlign: 'left' }}>
          <p className="dialog-message">
            {message || (
              <>You are about to place <strong>{totalOrders}</strong> order{totalOrders !== 1 ? 's' : ''}. Please review the details before proceeding.</>
            )}
          </p>

          {brokerList.length > 0 && (
            <div className="confirmation-summary">
              {brokerList.map(([broker, count], index) => (
                <div key={broker} className="confirmation-summary-row">
                  <span>{broker.charAt(0).toUpperCase() + broker.slice(1)}</span>
                  <span>{count} order{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}

          <div className="dialog-note">
            <strong>Total Orders:</strong> {totalOrders}
          </div>

          <p className="dialog-footnote">
            This action cannot be undone. Please review the orders carefully.
          </p>
        </div>

        <div className="modal-footer dialog-actions">
          <button className="button button-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="button button-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationDialog
