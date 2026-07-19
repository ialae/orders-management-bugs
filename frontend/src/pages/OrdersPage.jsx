import { useEffect, useRef, useState } from 'react'
import { ordersApi } from '../api.js'
import ClientSearch from '../components/ClientSearch.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import OrderForm from '../components/OrderForm.jsx'
import Pagination from '../components/Pagination.jsx'
import { formatCurrency, formatDate } from '../format.js'
import { ORDER_STATUSES, STATUS_LABELS } from '../constants.js'

const PAGE_SIZE = 10

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [editingOrder, setEditingOrder] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const requestId = useRef(0)

  async function loadOrders() {
    const id = ++requestId.current
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
      if (id !== requestId.current) return
      if (data.items.length === 0 && data.page > 1) {
        setPage(data.page - 1)
        return
      }
      setOrders(data.items)
      setTotal(data.total)
    } catch (err) {
      if (id !== requestId.current) return
      setError(err.message)
    } finally {
      if (id !== requestId.current) return
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
      await loadOrders()
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await ordersApi.remove(deletingOrder.id)
      setDeletingOrder(null)
      await loadOrders()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
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
        <div className="filter-search-wrapper">
          <label className="inline-label">
            Client
            <ClientSearch
              value={clientFilter}
              onChange={(id) => {
                setPage(1)
                setClientFilter(id)
              }}
              placeholder="All clients..."
            />
          </label>
        </div>

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

        <div className="filter-dates">
          <label className="inline-label">
            From
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
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
              min={dateFrom || undefined}
              onChange={(e) => {
                setPage(1)
                setDateTo(e.target.value)
              }}
            />
          </label>
        </div>

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
                  {clientFilter || statusFilter || dateFrom || dateTo
                    ? 'No orders match your filters.'
                    : 'No orders yet.'}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.client_name}</td>
                  <td>{order.product_name}</td>
                  <td>{order.quantity}</td>
                  <td>{formatCurrency(order.unit_price)}</td>
                  <td>{formatCurrency(order.total)}</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td>{formatDate(order.order_date)}</td>
                  <td>
                    <div className="actions-cell">
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
                    </div>
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
          onCancel={() => {
            setDeletingOrder(null)
            setDeleteError('')
          }}
          loading={deleting}
          error={deleteError}
        />
      )}
    </div>
  )
}
