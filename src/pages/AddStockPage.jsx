import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { stockAPI } from '../../../src/api/stockAPI.js'
import usePersistentDraft from '../../../src/hooks/usePersistentDraft.js'

const ADD_STOCK_STORAGE_KEY = 'stock_add_modal_draft_v1'
const ADD_STOCK_INITIAL_STATE = {
  symbol: '',
  stock_name: '',
  industry: '',
  sector: '',
  macro_sector: '',
  known_sector: '',
  basic_industry: '',
  equity_type: 'stock',
  symbol_token: '',
  exchange: 'nse',
}

const AddStockPage = ({ setStatus }) => {
  const navigate = useNavigate()
  const [draft, setDraft, resetDraft] = usePersistentDraft(
    ADD_STOCK_STORAGE_KEY,
    ADD_STOCK_INITIAL_STATE
  )
  const {
    symbol,
    stock_name,
    industry,
    sector,
    macro_sector,
    known_sector,
    basic_industry,
    equity_type,
    symbol_token,
  } = draft

  const [exchange, setExchangeDraft] = useState(draft.exchange || 'nse')
  const [sectorOptions, setSectorOptions] = useState([])
  const [industryOptions, setIndustryOptions] = useState([])
  const [macroSectorOptions, setMacroSectorOptions] = useState([])
  const [knownSectorOptions, setKnownSectorOptions] = useState([])
  const [basicIndustryOptions, setBasicIndustryOptions] = useState([])
  const [equityTypeOptions, setEquityTypeOptions] = useState(['stock', 'etf', 'other'])
  const [stockMasterCache, setStockMasterCache] = useState([])
  const [stockSymbolsCache, setStockSymbolsCache] = useState(null)
  const symbolFetchRef = useRef(null)
  const [duplicateError, setDuplicateError] = useState('')
  const [originalSymbol, setOriginalSymbol] = useState(null)

  const setStockName = useCallback(
    (value) => {
      setDraft((prev) => ({ ...prev, stock_name: value }))
      setDuplicateError('')
    },
    [setDraft]
  )

  const setSector = useCallback(
    (value) => setDraft((prev) => ({ ...prev, sector: value })),
    [setDraft]
  )
  const setIndustry = useCallback(
    (value) => setDraft((prev) => ({ ...prev, industry: value })),
    [setDraft]
  )
  const setMacroSector = useCallback(
    (value) => setDraft((prev) => ({ ...prev, macro_sector: value })),
    [setDraft]
  )
  const setKnownSector = useCallback(
    (value) => setDraft((prev) => ({ ...prev, known_sector: value })),
    [setDraft]
  )
  const setBasicIndustry = useCallback(
    (value) => setDraft((prev) => ({ ...prev, basic_industry: value })),
    [setDraft]
  )
  const setSymbol = useCallback(
    (value) => setDraft((prev) => ({ ...prev, symbol: value })),
    [setDraft]
  )
  const setEquityType = useCallback(
    (value) =>
      setDraft((prev) => ({ ...prev, equity_type: value ? String(value).toLowerCase() : value })),
    [setDraft]
  )
  const setExchange = useCallback(
    (value) => {
      setDraft((prev) => ({ ...prev, exchange: value }))
      setExchangeDraft(value)
    },
    [setDraft]
  )
  const setSymbolToken = useCallback(
    (value) => setDraft((prev) => ({ ...prev, symbol_token: value })),
    [setDraft]
  )

  const normalizeEquityType = useCallback((val) => {
    if (val === undefined || val === null) return val
    const s = String(val).trim().toLowerCase()
    const mapping = {
      stock: 'stock',
      stocks: 'stock',
      equity: 'stock',
      etf: 'etf',
      index: 'index',
      other: 'other',
    }
    return mapping[s] || s
  }, [])

  const fetchStockNames = useCallback(async () => {
    try {
      const { data } = await stockAPI.fetchStockMaster()
      if (data) {
        setStockMasterCache(data)
      }
    } catch (error) {
      console.error('Error fetching stock master:', error)
    }
  }, [])

  useEffect(() => {
    fetchStockNames()
  }, [fetchStockNames])

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const { data } = await stockAPI.fetchDistinctValues('sector')
        if (data) setSectorOptions(data)
      } catch (error) {
        console.error('Error fetching sectors:', error)
      }
    }
    fetchSectors()
  }, [])

  useEffect(() => {
    const fetchEquityTypes = async () => {
      try {
        const { data } = await stockAPI.fetchDistinctValues('equity_type')
        if (data && Array.isArray(data) && data.length) {
          const normalized = data.map((d) => normalizeEquityType(d))
          setEquityTypeOptions((prev) => {
            const base = prev.map((p) => normalizeEquityType(p))
            const combined = Array.from(new Set([...base, ...normalized]))
            const order = ['stock', 'etf', 'index', 'other']
            combined.sort((a, b) => {
              const ai = order.indexOf(a)
              const bi = order.indexOf(b)
              if (ai === -1 && bi === -1) return a.localeCompare(b)
              if (ai === -1) return 1
              if (bi === -1) return -1
              return ai - bi
            })
            return combined
          })
        }
      } catch (error) {
        // ignore fallback to defaults
      }
    }
    fetchEquityTypes()
  }, [normalizeEquityType])

  useEffect(() => {
    const fetchIndustries = async () => {
      try {
        const { data } = await stockAPI.fetchDistinctValues('industry')
        if (data) setIndustryOptions(data)
      } catch (error) {
        console.error('Error fetching industries:', error)
      }
    }
    fetchIndustries()
  }, [])

  useEffect(() => {
    const fetchMacroSectors = async () => {
      try {
        const { data } = await stockAPI.fetchDistinctValues('macro_sector')
        if (data) setMacroSectorOptions(data)
      } catch (error) {
        console.error('Error fetching macro sectors:', error)
      }
    }
    fetchMacroSectors()
  }, [])

  useEffect(() => {
    const fetchKnownSectors = async () => {
      try {
        const { data } = await stockAPI.fetchDistinctValues('known_sector')
        if (data) setKnownSectorOptions(data)
      } catch (error) {
        console.error('Error fetching known sectors:', error)
      }
    }
    fetchKnownSectors()
  }, [])

  useEffect(() => {
    const fetchBasicIndustries = async () => {
      try {
        const { data } = await stockAPI.fetchDistinctValues('basic_industry')
        if (data) setBasicIndustryOptions(data)
      } catch (error) {
        console.error('Error fetching basic industries:', error)
      }
    }
    fetchBasicIndustries()
  }, [])

  const ensureStockSymbols = useCallback(async () => {
    if (stockSymbolsCache) return stockSymbolsCache
    try {
      const { data } = await stockAPI.fetchStockSymbols()
      if (data) {
        setStockSymbolsCache(data)
        return data
      }
    } catch (err) {
      console.error('Error fetching stock symbols:', err)
    }
    return null
  }, [stockSymbolsCache])

  const findSymbolToken = useCallback((data, name, exch) => {
    if (!data || !name) return null
    const targetName = String(name).trim().toLowerCase()
    const targetExch = exch ? String(exch).trim().toLowerCase() : null

    let match = data.find((item) => {
      const n = (item.name || item.stock_name || item.symbol || item.symbol_gs || item.symbol_ao || '').toString().trim().toLowerCase()
      const e = (item.exchange || item.exch || item.market || '').toString().trim().toLowerCase()
      if (targetExch && e && e !== targetExch) return false
      return n === targetName
    })

    if (!match) {
      match = data.find((item) => {
        const n = (item.name || item.stock_name || item.symbol || '').toString().trim().toLowerCase()
        const e = (item.exchange || item.exch || item.market || '').toString().trim().toLowerCase()
        if (targetExch && e && e !== targetExch) return false
        return n.includes(targetName) || targetName.includes(n)
      })
    }

    if (!match) return null
    return match.symbol_token || match.token || match.symbol || match.symbol_ao || match.symbol_gs || match.id || null
  }, [])

  useEffect(() => {
    if (symbolFetchRef.current) clearTimeout(symbolFetchRef.current)
    symbolFetchRef.current = setTimeout(async () => {
      try {
        const data = await ensureStockSymbols()
        const token = findSymbolToken(data, stock_name, draft.exchange || exchange)
        if (token) {
          setSymbolToken(token)
        }
      } catch (err) {
        // ignore
      }
    }, 350)
    return () => {
      if (symbolFetchRef.current) clearTimeout(symbolFetchRef.current)
    }
  }, [stock_name, draft.exchange, exchange, ensureStockSymbols, findSymbolToken, setSymbolToken])

  useEffect(() => {
    if (!basic_industry) return

    const matchedRecords = stockMasterCache.filter(
      (item) => item.basic_industry?.toLowerCase() === basic_industry?.toLowerCase()
    )

    if (matchedRecords.length > 0) {
      const firstMatch = matchedRecords[0]
      setMacroSector(firstMatch.macro_sector ?? '')
      setKnownSector(firstMatch.known_sector ?? '')
      setSector(firstMatch.sector ?? '')
      setIndustry(firstMatch.industry ?? '')
    }
  }, [basic_industry, stockMasterCache, setMacroSector, setKnownSector, setSector, setIndustry])

  const handleAddOrUpdateStock = async () => {
    if (!stock_name) {
      alert('Stock Name is required')
      return
    }
    if (!symbol) {
      alert('Symbol is required')
      return
    }

    const exists = stockMasterCache.some(
      (item) =>
        item.stock_name?.toLowerCase() === stock_name?.trim().toLowerCase() &&
        item.symbol !== originalSymbol
    )

    if (exists) {
      setDuplicateError(`Stock name "${stock_name}" already exists in the database.`)
      return
    }

    const payload = {
      symbol,
      stock_name,
      industry: industry || null,
      sector: sector || null,
      macro_sector: macro_sector || null,
      known_sector: known_sector || null,
      basic_industry: basic_industry || null,
      equity_type: equity_type || null,
      symbol_token: symbol_token || null,
    }

    try {
      if (originalSymbol) {
        await stockAPI.updateStockMaster(originalSymbol, payload)
      } else {
        await stockAPI.addStockMaster(payload)
      }
      setStatus?.({ type: 'success', message: originalSymbol ? 'Stock updated successfully!' : 'Stock added successfully!' })
      await fetchStockNames()
      resetDraft()
      navigate('/buy-order', { state: { refresh: true, newStock: stock_name } })
    } catch (error) {
      alert('Error saving stock: ' + error.message)
    }
  }

  const handleStockNameChange = useCallback(
    (value) => {
      setStockName(value)
    },
    [setStockName]
  )

  const handleCancel = () => {
    resetDraft()
    navigate('/buy-order')
  }

  return (
    <div className="page card" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.9rem' }}>Add New Stock</h1>
          
        </div>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            border: '1px solid rgba(148, 163, 184, 0.25)',
            background: 'transparent',
            color: '#fff',
            borderRadius: 12,
            padding: '10px 16px',
            cursor: 'pointer',
          }}
        >
          Back to Buy Order
        </button>
      </div>

      <div className="space-y-4">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <div>
            <label className="label" htmlFor="exchange">Exchange</label>
            <select
              id="exchange"
              value={draft.exchange || exchange}
              onChange={(e) => setExchange(e.target.value)}
              className="select"
            >
              <option value="nse">NSE</option>
              <option value="bse">BSE</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="equityType">Equity Type</label>
            <select
              id="equityType"
              value={equity_type}
              onChange={(e) => setEquityType(e.target.value)}
              className="select"
            >
              {equityTypeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="stockName">Stock Name</label>
            <input
              id="stockName"
              placeholder="Stock Name"
              value={stock_name}
              onChange={(e) => handleStockNameChange(e.target.value)}
              className="input"
            />
            {duplicateError && <p style={{ marginTop: 8, color: '#fca5a5' }}>{duplicateError}</p>}
          </div>

          <div>
            <label className="label" htmlFor="symbolToken">Symbol Token</label>
            <input
              id="symbolToken"
              placeholder="Symbol Token (exchange id)"
              value={symbol_token}
              onChange={(e) => setSymbolToken(e.target.value)}
              className="input"
            />
          </div>



          <div>
            <label className="label" htmlFor="symbol">Symbol</label>
            <input
              id="symbol"
              placeholder="Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="basicIndustry">Basic Industry</label>
            <input
              id="basicIndustry"
              list="basicIndustryOptions"
              placeholder="Basic Industry"
              value={basic_industry}
              onChange={(e) => setBasicIndustry(e.target.value)}
              className="input"
            />
            <datalist id="basicIndustryOptions">
              {basicIndustryOptions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label" htmlFor="macroSector">Macro Sector</label>
            <input
              id="macroSector"
              list="macroSectorOptions"
              placeholder="Macro Sector"
              value={macro_sector}
              onChange={(e) => setMacroSector(e.target.value)}
              className="input"
            />
            <datalist id="macroSectorOptions">
              {macroSectorOptions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label" htmlFor="knownSector">Known Sector</label>
            <input
              id="knownSector"
              list="knownSectorOptions"
              placeholder="Known Sector"
              value={known_sector}
              onChange={(e) => setKnownSector(e.target.value)}
              className="input"
            />
            <datalist id="knownSectorOptions">
              {knownSectorOptions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label" htmlFor="sector">Sector</label>
            <input
              id="sector"
              list="sectorOptions"
              placeholder="Sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="input"
            />
            <datalist id="sectorOptions">
              {sectorOptions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label" htmlFor="industry">Industry</label>
            <input
              id="industry"
              list="industryOptions"
              placeholder="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="input"
            />
            <datalist id="industryOptions">
              {industryOptions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            type="button"
            className="button"
            style={{ backgroundColor: 'rgba(79, 70, 229, 0.8)' }}
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={handleAddOrUpdateStock}
          >
            Add Stock
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddStockPage
