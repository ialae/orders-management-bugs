export default function ConfirmDialog({ title, message, onConfirm, onCancel, loading, error }) {
  return (
    <div className="modal-overlay">
      <div className="modal confirm-dialog">
        <h3>{title}</h3>
        {error && <div className="form-error">{error}</div>}
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
