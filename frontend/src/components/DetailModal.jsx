import { Fragment } from 'react'

export default function DetailModal({ title, fields, onClose }) {
    return (
        <div className="modal-overlay">
            <div className="modal">
                <h3>{title}</h3>
                <dl className="detail-grid">
                    {fields.map(({ label, value }) => (
                        <Fragment key={label}>
                            <dt>{label}</dt>
                            <dd>{value || '-'}</dd>
                        </Fragment>
                    ))}
                </dl>
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}