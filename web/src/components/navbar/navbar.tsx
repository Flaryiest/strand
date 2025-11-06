import styles from "./navbar.module.css"
import { Link } from 'react-router-dom';

export default function Navbar() {
    return (
        <div className={styles.navbarContainer}>
            <div className={styles.navbar}>
                <Link to="/" className={styles.logo}>Strand</Link>
                <div className={styles.links}>
                    <Link to="/pricing" className={styles.link}>Pricing</Link>
                    <Link to="/demo" className={styles.link}>Demo</Link>
                    <Link to="/login" className={`${styles.link} ${styles.login}`}>Login</Link>

                </div>
            </div>
        </div>
    )
}