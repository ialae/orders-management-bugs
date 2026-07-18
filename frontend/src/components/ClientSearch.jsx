import { useCallback, useEffect, useRef, useState } from 'react'
import { clientsApi } from '../api.js'

export default function ClientSearch({ value, onChange, placeholder, initialQuery, inputRef }) {
  const [query, setQuery] = useState(initialQuery || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)
  const abortRef = useRef(null)
  const wrapperRef = useRef(null)
  const selectedName = useRef('')

  const search = useCallback(async (q) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const data = await clientsApi.list({ search: q || undefined, page_size: 20 }, { signal: controller.signal })
      setResults(data.items)
    } catch (err) {
      if (err.name !== 'AbortError') setResults([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer.current)
  }, [query, search])

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (value && !selectedName.current) {
      clientsApi.get(value).then((client) => {
        selectedName.current = client.name
        setQuery(client.name)
      }).catch(() => {})
    } else if (!value) {
      selectedName.current = ''
      setQuery('')
    }
  }, [value])

  function select(client) {
    selectedName.current = client.name
    setQuery(client.name)
    setOpen(false)
    onChange(client.id)
  }

  function handleInput(e) {
    setQuery(e.target.value)
    setOpen(true)
    selectedName.current = ''
    if (!value) onChange('')
  }

  function handleBlur() {
    if (!selectedName.current && query) {
      setQuery(selectedName.current || '')
    }
  }

  return (
    <div className="client-search" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => { if (results.length || loading) setOpen(true) }}
        onBlur={handleBlur}
        placeholder={placeholder || 'Search clients...'}
        autoComplete="off"
      />
      {open && (
        <div className="client-search-dropdown">
          {loading ? (
            <div className="client-search-option disabled">Searching...</div>
          ) : results.length === 0 ? (
            <div className="client-search-option disabled">No clients found.</div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`client-search-option${c.id === value ? ' active' : ''}`}
                onClick={() => select(c)}
                onMouseDown={(e) => e.preventDefault()}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
