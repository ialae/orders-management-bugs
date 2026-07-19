import { useEffect, useState } from 'react'
import { clientsApi, ordersApi } from '../api.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import OrderForm from '../components/OrderForm.jsx'
import Pagination from '../components/Pagination.jsx'
import { ORDER_STATUSES, STATUS_LABELS } from '../constants.js'

const PAGE_SIZE = 10

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [clientOptions, setClientOptions] = useState([])
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [editingOrder, setEditingOrder] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState(null)

  useEffect(() => {
    clientsApi.options().then(setClientOptions).catch((err) => setError(err.message))
  }, [])

  async function loadOrders() {
    setLoading(true)
    setError('')
    try {
      const data = await ordersApi.list({
        client_id: clientFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setOrders(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, clientFilter, statusFilter, dateFrom, dateTo])

  function openCreateForm() {
    setEditingOrder(null)
    setShowForm(true)
  }

  function openEditForm(order) {
    setEditingOrder(order)
    setShowForm(true)
  }

  async function handleSave(payload) {
    setSaving(true)
    try {
      if (editingOrder) {
        await ordersApi.update(editingOrder.id, payload)
      } else {
        await ordersApi.create(payload)
      }
      setShowForm(false)
      await loadOrders()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await ordersApi.remove(deletingOrder.id)
      setDeletingOrder(null)
      await loadOrders()
    } catch (err) {
      setDeletingOrder(null)
      setError(err.message)
    }
  }

  function resetFilters() {
    setPage(1)
    setClientFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div>
      <div className="page-header">
        <h2>Orders</h2>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          + Add Order
        </button>
      </div>

      <div className="filter-bar">
        <select
          value={clientFilter}
          onChange={(e) => {
            setPage(1)
            setClientFilter(e.target.value)
          }}
        >
          <option value="">All clients</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1)
            setStatusFilter(e.target.value)
          }}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <label className="inline-label">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPage(1)
              setDateFrom(e.target.value)
            }}
          />
        </label>

        <label className="inline-label">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPage(1)
              setDateTo(e.target.value)
            }}
          />
        </label>

        <button type="button" className="btn btn-secondary" onClick={resetFilters}>
          Clear filters
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Status</th>
              <th>Order Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  Loading...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.client_name}</td>
                  <td>{order.product_name}</td>
                  <td>{order.quantity}</td>
                  <td>${Number(order.unit_price).toFixed(2)}</td>
                  <td>${Number(order.total).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td>{new Date(order.order_date).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn-link" onClick={() => openEditForm(order)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-link btn-link-danger"
                      onClick={() => setDeletingOrder(order)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {showForm && (
        <OrderForm
          order={editingOrder}
          clientOptions={clientOptions}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {deletingOrder && (
        <ConfirmDialog
          title="Delete Order"
          message={`Are you sure you want to delete this order for ${deletingOrder.client_name}?`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingOrder(null)}
        />
      )}
    </div>
  )
}
