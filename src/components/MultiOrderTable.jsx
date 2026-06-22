import React, { useState, useEffect } from 'react'
import { FiEdit, FiPlus, FiTrash2 } from 'react-icons/fi'
import '../App.css'
import { useStockSearch } from '../hooks/useStockSearch'

function MultiOrderTable({ orders, onUpdate, onDelete, onDuplicate, backendBase = '' }) {
  const [editingOrder, setEditingOrder] = useState(null)
  const { suggestions, searchTerm, setSearchTerm, loadStockMaster } = useStockSearch(backendBase)

  useEffect(() => {
    // load stock master once so suggestions are available in modal
    loadStockMaster()
  }, [loadStockMaster])

  const openEditModal = (order) => {
    setEditingOrder({ ...order })
    // initialize search term for suggestions
    setSearchTerm(order.stock || '')
  }

  const handleSave = () => {
    if (!editingOrder) return
    const updatePayload = {
      stock: editingOrder.stock,
      broker: editingOrder.broker,
      account: editingOrder.account,
      quantity: Number(editingOrder.quantity),
      orderType: editingOrder.orderType,
      price: editingOrder.orderType === 'LIMIT' ? Number(editingOrder.price) : null,
    }
    onUpdate(editingOrder.id, updatePayload)
    setEditingOrder(null)
  }

  const handleCancel = () => {
    setEditingOrder(null)
  }

  return (
    <>
      {orders.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px',
            color: '#94a3b8',
            fontSize: '14px',
            border: '1px dashed rgba(148, 163, 184, 0.24)',
            borderRadius: '4px',
            marginTop: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
          }}
        >
          No orders added yet. Fill in the form above to add an order.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '20px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              backgroundColor: 'transparent',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  borderBottom: '2px solid rgba(148, 163, 184, 0.16)',
                }}
              >
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#cbd5e1' }}>Stock</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#cbd5e1' }}>Broker</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#cbd5e1' }}>Account</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#cbd5e1' }}>Qty</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#cbd5e1' }}>Type</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#cbd5e1' }}>Price</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#cbd5e1' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  style={{
                    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  }}
                >
                  <td style={{ padding: '10px' }}>{order.stock}</td>
                  <td style={{ padding: '10px', textTransform: 'capitalize' }}>{order.broker}</td>
                  <td style={{ padding: '10px' }}>{order.account}</td>
                  <td style={{ padding: '10px' }}>{order.quantity}</td>
                  <td style={{ padding: '10px' }}>{order.orderType}</td>
                  <td style={{ padding: '10px' }}>{order.orderType === 'LIMIT' ? order.price : '-'}</td>
                  <td
                    style={{
                      padding: '10px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '6px',
                      flexWrap: 'nowrap',
                    }}
                  >
                    <button
                      onClick={() => openEditModal(order)}
                      title="Edit"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        backgroundColor: 'rgba(56, 189, 248, 0.18)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.24)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <FiEdit size={16} />
                    </button>
                    <button
                      onClick={() => onDuplicate(order.id)}
                      title="Duplicate order"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        backgroundColor: 'rgba(251, 146, 60, 0.18)',
                        color: '#f97316',
                        border: '1px solid rgba(251, 146, 60, 0.24)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <FiPlus size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(order.id)}
                      title="Delete"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        backgroundColor: 'rgba(248, 113, 113, 0.18)',
                        color: '#f87171',
                        border: '1px solid rgba(248, 113, 113, 0.24)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingOrder && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div className="modal-content" style={{ width: 'min(100%, 520px)', backgroundColor: '#0f172a', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: '24px', border: '1px solid rgba(148, 163, 184, 0.16)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Edit Order</h3>
              <button
                onClick={handleCancel}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px' }}>Stock</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.24)', background: '#1e293b', color: '#e2e8f0' }}
                    type="text"
                    value={editingOrder.stock}
                    onChange={(e) => {
                      setEditingOrder({ ...editingOrder, stock: e.target.value })
                      setSearchTerm(e.target.value)
                    }}
                    autoComplete="off"
                  />
                  {searchTerm && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 60, top: '102%', left: 0, right: 0, background: '#0b1220', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 8, marginTop: 6, maxHeight: 220, overflow: 'auto' }}>
                      {suggestions.map((item, idx) => (
                        <button
                          key={`${item.name}-${idx}`}
                          type="button"
                          onClick={() => {
                            setEditingOrder({ ...editingOrder, stock: item.name })
                            setSearchTerm('')
                          }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', color: '#e2e8f0', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px' }}>Broker</label>
                  <select
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.24)', background: '#1e293b', color: '#e2e8f0' }}
                    value={editingOrder.broker}
                    onChange={(e) => setEditingOrder({ ...editingOrder, broker: e.target.value })}
                  >
                    <option value="">Select broker</option>
                    <option value="zerodha">Zerodha</option>
                    <option value="angel">Angel One</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px' }}>Account</label>
                  <select
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.24)', background: '#1e293b', color: '#e2e8f0' }}
                    value={editingOrder.account}
                    onChange={(e) => setEditingOrder({ ...editingOrder, account: e.target.value })}
                  >
                    <option value="">Select account</option>
                    <option value="PM">PM</option>
                    <option value="PDM">PDM</option>
                    <option value="PSM">PSM</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px' }}>Quantity</label>
                  <input
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.24)', background: '#1e293b', color: '#e2e8f0' }}
                    type="number"
                    min="1"
                    value={editingOrder.quantity}
                    onChange={(e) => setEditingOrder({ ...editingOrder, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px' }}>Order Type</label>
                  <select
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.24)', background: '#1e293b', color: '#e2e8f0' }}
                    value={editingOrder.orderType}
                    onChange={(e) => setEditingOrder({ ...editingOrder, orderType: e.target.value })}
                  >
                    <option value="LIMIT">Limit</option>
                    <option value="MARKET">Market</option>
                  </select>
                </div>
              </div>
              {editingOrder.orderType === 'LIMIT' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px' }}>Limit Price</label>
                  <input
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.24)', background: '#1e293b', color: '#e2e8f0' }}
                    type="number"
                    min="0"
                    step="0.05"
                    value={editingOrder.price ?? ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, price: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                onClick={handleCancel}
                style={{
                  backgroundColor: '#475569',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  backgroundColor: '#10b981',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default MultiOrderTable
