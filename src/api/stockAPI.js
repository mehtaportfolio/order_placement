const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || ''

const getHeaders = (token) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

const handleResponse = async (response) => {
  const payload = await response.text()

  let data
  try {
    data = payload ? JSON.parse(payload) : null
  } catch {
    data = payload
  }

  if (!response.ok) {
    const message = data?.message || response.statusText || 'Request failed'
    throw new Error(message)
  }

  return data
}

const normalizeResponseData = (result) => {
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object' && Array.isArray(result.data)) {
    return result.data
  }
  return []
}

const createStockSymbolRecord = (item) => ({
  ...item,
  symbol_token:
    item.symbol_token ||
    item.token ||
    item.symbol ||
    item.symbol_gs ||
    item.symbol_ao ||
    item.id ||
    '',
  name:
    item.stock_name ||
    item.name ||
    item.symbol ||
    item.symbol_token ||
    '',
  exchange:
    item.exchange ||
    item.exch ||
    item.market ||
    'nse',
})

export const stockAPI = {
  async fetchStockMaster(token) {
    const response = await fetch(
      `${API_BASE_URL}/api/buy-order/stock-master`,
      {
        headers: getHeaders(token),
      }
    )

    const result = await handleResponse(response)

    return {
      data: normalizeResponseData(result),
    }
  },

  // Reverted to frontend-generated distinct values
  async fetchDistinctValues(field, token) {
    const { data } = await this.fetchStockMaster(token)

    const unique = Array.from(
      new Set(
        data
          .map((item) => item[field])
          .filter(
            (value) =>
              value !== undefined &&
              value !== null &&
              String(value).trim() !== ''
          )
          .map((value) => String(value).trim())
      )
    )

    unique.sort((a, b) => a.localeCompare(b))

    return {
      data: unique,
    }
  },

async fetchStockMasterFull(token) {
  const response = await fetch(
    `${API_BASE_URL}/api/buy-order/stock-master-full`,
    {
      headers: getHeaders(token),
    }
  )

  const result = await handleResponse(response)

  return {
    data: normalizeResponseData(result),
  }
},

async fetchSymbolToken(stockName, exchange, token) {
  const params = new URLSearchParams({
    stock_name: stockName,
    exchange,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/buy-order/symbol-token?${params}`,
    {
      headers: getHeaders(token),
    }
  );

  return handleResponse(response);
},

  async fetchStockSymbols(token) {
    const { data } = await this.fetchStockMaster(token)

    return {
      data: data.map(createStockSymbolRecord),
    }
  },

  async addStockMaster(stockData, token) {
    const response = await fetch(
      `${API_BASE_URL}/api/buy-order/stock-master`,
      {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(stockData),
      }
    )

    return handleResponse(response)
  },

  async updateStockMaster(symbol, stockData, token) {
    const encodedSymbol = encodeURIComponent(symbol)

    const response = await fetch(
      `${API_BASE_URL}/api/buy-order/stock-master/${encodedSymbol}`,
      {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(stockData),
      }
    )

    return handleResponse(response)
  },
}