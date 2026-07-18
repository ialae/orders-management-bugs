import { useState } from 'react'
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

export default function OrderForm({ order, clientOptions, onSave, onCancel, saving, optionsLoading, optionsError }) {
  const [form, setForm] = useState(toFormValues(order))
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
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
    <div className="modal-overlay">
      <div className="modal">
        <h3>{order ? 'Edit Order' : 'Add Order'}</h3>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            Client
            {optionsError && <div className="form-error">{optionsError}</div>}
            {optionsLoading ? (
              <div className="form-help">Loading clients...</div>
            ) : (
              <select name="client_id" value={form.client_id} onChange={handleChange} required>
                <option value="">Select a client...</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
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
              min="0"
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
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
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
