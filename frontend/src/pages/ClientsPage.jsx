import { useEffect, useRef, useState } from 'react'
import { clientsApi } from '../api.js'
import { formatDate } from '../format.js'
import ClientForm from '../components/ClientForm.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 10

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editingClient, setEditingClient] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingClient, setDeletingClient] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const requestId = useRef(0)

  async function loadClients() {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const data = await clientsApi.list({ search, page, page_size: PAGE_SIZE })
      if (id !== requestId.current) return
      if (data.items.length === 0 && data.page > 1) {
        setPage(data.page - 1)
        return
      }
      setClients(data.items)
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
    loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search])

  function openCreateForm() {
    setEditingClient(null)
    setShowForm(true)
  }

  function openEditForm(client) {
    setEditingClient(client)
    setShowForm(true)
  }

  async function handleSave(form) {
    setSaving(true)
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, form)
      } else {
        await clientsApi.create(form)
      }
      await loadClients()
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await clientsApi.remove(deletingClient.id)
      setDeletingClient(null)
      await loadClients()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Clients</h2>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          + Add Client
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
        />
      </div>

      {error && (
        <div className="form-error">
          {error}
          <button type="button" className="btn-link" onClick={loadClients} style={{ marginLeft: 8 }}>
            Retry
          </button>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Loading...
                </td>
              </tr>
            ) : clients.length === 0 && !error ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  {search ? 'No clients match your search.' : 'No clients yet.'}
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.email}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.address || '-'}</td>
                  <td>{formatDate(client.created_at)}</td>
                  <td>
                    <div className="actions-cell">
                      <button type="button" className="btn-link" onClick={() => openEditForm(client)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-link btn-link-danger"
                        onClick={() => setDeletingClient(client)}
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
        <ClientForm
          initialValues={editingClient}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {deletingClient && (
        <ConfirmDialog
          title="Delete Client"
          message={`Are you sure you want to delete ${deletingClient.name}?`}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeletingClient(null)
            setDeleteError('')
          }}
          loading={deleting}
          error={deleteError}
        />
      )}
    </div>
  )
}
