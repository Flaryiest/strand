import styles from './index.module.css'

import Navbar from "@components/navbar/navbar"

export default function IndexPage() {
  return (
    <div className={styles.pageContainer}>  
      <Navbar />
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1 className={styles.title}>The AI for Adventure</h1>
          <p className={styles.subtitle}>Find the best food, best stores, best locations for all your needs.</p>
        </div>
      </div>
    </div>
  );
}