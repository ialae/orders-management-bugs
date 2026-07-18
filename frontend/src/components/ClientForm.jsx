import { useEffect, useState } from 'react'

const EMPTY_FORM = { name: '', email: '', phone: '', address: '' }

export default function ClientForm({ initialValues, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initialValues || EMPTY_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(initialValues || EMPTY_FORM)
    setError('')
  }, [initialValues])

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

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
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
        <h3>{initialValues ? 'Edit Client' : 'Add Client'}</h3>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input name="name" value={form.name} onChange={handleChange} required maxLength={255} />
          </label>
          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              maxLength={255}
            />
          </label>
          <label>
            Phone
            <input name="phone" value={form.phone || ''} onChange={handleChange} maxLength={50} />
          </label>
          <label>
            Address
            <input name="address" value={form.address || ''} onChange={handleChange} maxLength={500} />
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
