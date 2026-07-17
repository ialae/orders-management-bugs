import { useState } from 'react'

const EMPTY_FORM = { name: '', email: '', phone: '', address: '' }

export default function ClientForm({ initialValues, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initialValues || EMPTY_FORM)
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }

    try {
      await onSave(form)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{initialValues ? 'Edit Client' : 'Add Client'}</h3>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input name="name" value={form.name} onChange={handleChange} maxLength={255} required />
          </label>
          <label className="field-label">
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Phone
            <input name="phone" value={form.phone || ''} onChange={handleChange} />
          </label>
          <label>
            Address
            <input name="address" value={form.address || ''} onChange={handleChange} />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
