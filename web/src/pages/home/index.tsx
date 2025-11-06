import styles from './index.module.css'

import { Link } from 'react-router-dom';
import Navbar from "@components/navbar/navbar"
import Footer from "@components/footer/footer"


export default function IndexPage() {
  return (
    <div className={styles.pageContainer}>  
      <Navbar />
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1 className={styles.title}>The AI for Adventure</h1>
          <p className={styles.subtitle}>Find the best food, best stores, best locations for all your needs.</p>
          <Link className={styles.ctaButton} to="/demo">Get Started</Link>
          <img src="/landing/maps.jpg" className={styles.heroImage} />
        </div>
      </div>
      <div className={styles.featuresSection}>
        <h2 className={styles.featureTitle}>Prompt to plan in seconds.</h2>
        <div className={styles.featureCardContainer}>
          <div className={styles.featureCardOne}>

          </div>
        </div>
      </div>
      <Footer/>
    </div>
  );
}