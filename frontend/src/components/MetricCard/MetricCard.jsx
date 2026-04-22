import styles from './MetricCard.module.css'

export default function MetricCard({ icon: Icon, label, value, subtitle, variant = 'primary' }) {
  return (
    <article className={styles.card}>
      <span className={`${styles.iconWrap} ${styles[variant]}`}>
        <Icon size={24} aria-hidden="true" />
      </span>
      <section className={styles.content}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </section>
    </article>
  )
}
