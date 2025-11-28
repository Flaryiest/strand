import styles from './navbar.module.css';
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        Strand
      </Link>
      <nav className={styles.nav}>
        <Link to="/demo" className={styles.navLink}>
          Demo
        </Link>
        <Link to="/pricing" className={styles.navLink}>
          Pricing
        </Link>
        <Link to="/login" className={styles.loginButton}>
          Sign In
        </Link>
      </nav>
    </header>
  );
}
