import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ title, message, onConfirm, onCancel, loading, error }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Escape' && !loading) {
      onCancel()
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget && !loading) {
      onCancel()
    }
  }

  return (
    <div
      className="modal-overlay"
      onKeyDown={handleKeyDown}
      onClick={handleOverlayClick}
    >
      <div
        className="modal confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3>{title}</h3>
        {error && <div className="form-error">{error}</div>}
        <p>{message}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
            ref={cancelRef}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
