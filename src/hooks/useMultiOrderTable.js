import { useState, useCallback, useRef } from 'react'

/**
 * Hook for managing multi-order table state
 * Handles adding, editing, deleting, and duplicating orders
 */
export function useMultiOrderTable() {
  const [orders, setOrders] = useState([])
  const nextIdRef = useRef(0)

  // Add a new order to the table
  const addOrder = useCallback((orderData) => {
    const newOrder = {
      id: nextIdRef.current,
      ...orderData,
    }
    setOrders((prev) => [...prev, newOrder])
    nextIdRef.current += 1
    return newOrder
  }, [])

  // Update an existing order
  const updateOrder = useCallback((id, updates) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, ...updates } : order))
    )
  }, [])

  // Delete an order from the table
  const deleteOrder = useCallback((id) => {
    setOrders((prev) => prev.filter((order) => order.id !== id))
  }, [])

  // Duplicate an order (copy with new ID)
  const duplicateOrder = useCallback(
    (id) => {
      const orderToDuplicate = orders.find((order) => order.id === id)
      if (!orderToDuplicate) return null

      const duplicatedOrder = {
        id: nextIdRef.current,
        stock: orderToDuplicate.stock,
        broker: orderToDuplicate.broker,
        account: orderToDuplicate.account,
        quantity: orderToDuplicate.quantity,
        orderType: orderToDuplicate.orderType,
        price: orderToDuplicate.price,
      }
      setOrders((prev) => [...prev, duplicatedOrder])
      nextIdRef.current += 1
      return duplicatedOrder
    },
    [orders]
  )

  // Clear all orders
  const clearOrders = useCallback(() => {
    setOrders([])
  }, [])

  // Get broker-wise order count
  const getBrokerWiseCount = useCallback(() => {
    const counts = {}
    orders.forEach((order) => {
      counts[order.broker] = (counts[order.broker] || 0) + 1
    })
    return counts
  }, [orders])

  return {
    orders,
    addOrder,
    updateOrder,
    deleteOrder,
    duplicateOrder,
    clearOrders,
    getBrokerWiseCount,
    orderCount: orders.length,
  }
}
