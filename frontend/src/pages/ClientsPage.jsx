import { useCallback, useEffect, useState } from 'react'
import { clientsApi } from '../api.js'
import ClientForm from '../components/ClientForm.jsx'
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

  const loadClients = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await clientsApi.list({ search, page, page_size: PAGE_SIZE })
      setClients(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    loadClients()
  }, [loadClients])

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
      setShowForm(false)
      await loadClients()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(client) {
    setError('')
    try {
      await clientsApi.remove(client.id)
      await loadClients()
    } catch (err) {
      setError(err.message)
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
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No clients found.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.email}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.address || '-'}</td>
                  <td>{new Date(client.created_at).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn-link" onClick={() => openEditForm(client)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-link btn-link-danger"
                      onClick={() => handleDelete(client)}
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
        <ClientForm
          initialValues={editingClient}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
