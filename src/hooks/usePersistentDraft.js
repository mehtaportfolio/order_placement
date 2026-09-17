import { useEffect, useMemo, useRef, useState } from 'react'

const usePersistentDraft = (storageKey, initialState) => {
  const initialSnapshot = useMemo(() => {
    if (typeof window === 'undefined') return initialState
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return initialState
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null ? parsed : initialState
    } catch (error) {
      console.warn(`usePersistentDraft: failed to parse ${storageKey}`, error)
      return initialState
    }
  }, [initialState, storageKey])

  const [draft, setDraft] = useState(initialSnapshot)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft))
    } catch (error) {
      console.warn(`usePersistentDraft: failed to persist ${storageKey}`, error)
    }
  }, [draft, storageKey])

  const resetDraft = () => {
    setDraft(initialState)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(storageKey)
    } catch (error) {
      console.warn(`usePersistentDraft: failed to clear ${storageKey}`, error)
    }
  }

  return [draft, setDraft, resetDraft]
}

export default usePersistentDraft
