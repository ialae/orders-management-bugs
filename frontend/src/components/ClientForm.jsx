import { useEffect, useRef, useState } from 'react'

const EMPTY_FORM = { name: '', email: '', phone: '', address: '' }

export default function ClientForm({ initialValues, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initialValues || EMPTY_FORM)
  const [error, setError] = useState('')
  const firstInput = useRef(null)
  const title = initialValues ? 'Edit Client' : 'Add Client'

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
            Name
            <input ref={firstInput} name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>
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
