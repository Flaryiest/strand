import styles from './footer.module.css';

export default function Footer() {
  return (
    <div className={styles.footerContainer}>
      <div className={styles.footer}>
        <div className={styles.brand}>
          <span className={styles.logo}>Strand</span>
          <span>
            Strand is the AI built to assist you in your daily trips. We know
            the struggle of finding the perfect date spot or matcha.
          </span>
        </div>
        <div className={styles.product}>
          <h3 className={styles.sectionTitle}>Product</h3>
        </div>
        <div className={styles.resources}>
          <h3 className={styles.sectionTitle}>Resources</h3>
        </div>
        <div className={styles.legal}>
          <h3 className={styles.sectionTitle}>Legal</h3>
        </div>
      </div>
      <div className={styles.bottomBar}>
        <span className={styles.copy}>
          &copy; 2025 Strand. All rights reserved.
        </span>
        <div className={styles.socialContainer}>
          <a href="https://twitter.com/strandai_" className={styles.socialLink}>
            Twitter
          </a>
          <a
            href="https://www.linkedin.com/company/strandai/"
            className={styles.socialLink}
          >
            LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}
