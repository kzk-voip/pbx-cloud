import styles from './StatusBadge.module.css'

export default function StatusBadge({ status = 'inactive', label }) {
  const variant = styles[status] || styles.inactive
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <span className={`${styles.badge} ${variant}`}>
      <span className={styles.dot} aria-hidden="true" />
      {displayLabel}
    </span>
  )
}
