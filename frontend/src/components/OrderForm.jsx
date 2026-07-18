import { useEffect, useRef, useState } from 'react'
import ClientSearch from './ClientSearch.jsx'
import { ORDER_STATUSES, STATUS_LABELS } from '../constants.js'

function toFormValues(order) {
  if (!order) {
    return {
      client_id: '',
      product_name: '',
      quantity: 1,
      unit_price: '',
      status: 'pending',
      order_date: new Date().toISOString().slice(0, 10),
    }
  }
  return {
    client_id: String(order.client_id),
    product_name: order.product_name,
    quantity: order.quantity,
    unit_price: order.unit_price,
    status: order.status,
    order_date: order.order_date,
  }
}

export default function OrderForm({ order, onSave, onCancel, saving }) {
  const [form, setForm] = useState(toFormValues(order))
  const [error, setError] = useState('')
  const firstInput = useRef(null)
  const title = order ? 'Edit Order' : 'Add Order'

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    firstInput.current?.focus()
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && !saving) {
      onCancel()
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget && !saving) {
      onCancel()
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.client_id) {
      setError('Please select a client.')
      return
    }
    if (!form.product_name.trim()) {
      setError('Product name is required.')
      return
    }
    if (Number(form.quantity) <= 0 || Number(form.unit_price) <= 0) {
      setError('Quantity and unit price must be greater than zero.')
      return
    }

    const payload = {
      client_id: Number(form.client_id),
      product_name: form.product_name,
      quantity: Number(form.quantity),
      unit_price: Number(form.unit_price),
      status: form.status,
      order_date: form.order_date,
    }

    try {
      await onSave(payload)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div
      className="modal-overlay"
      onKeyDown={handleKeyDown}
      onClick={handleOverlayClick}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            Client
            <ClientSearch
              value={form.client_id}
              onChange={(id) => setForm((prev) => ({ ...prev, client_id: id }))}
              initialQuery={order?.client_name}
              inputRef={firstInput}
            />
          </label>
          <label>
            Product
            <input
              name="product_name"
              value={form.product_name}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Quantity
            <input
              type="number"
              name="quantity"
              min="1"
              step="1"
              value={form.quantity}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Unit Price
            <input
              type="number"
              name="unit_price"
              min="0.01"
              step="0.01"
              value={form.unit_price}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Status
            <select name="status" value={form.status} onChange={handleChange}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order Date
            <input
              type="date"
              name="order_date"
              value={form.order_date}
              onChange={handleChange}
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
