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
              <div className={styles.featureSection}>
        <h2 className={styles.featureTitle}>Prompt to plan in seconds.</h2>
        <h3 className={styles.featureSubtitle}>3 Simple Steps to create your perfect journey.</h3>
        <div className={styles.featureCardContainer}>
          
            <div className={styles.featureColumnOne}>
              <div className={styles.featureOne}>
                <img src="/landing/journey.png" className={styles.featureImage}/>
              <div className={styles.featureOneText}>
                <h4 className={styles.featureOneTitle}>Describe your ideal trip</h4>
                <p className={styles.featureOneDescription}>We'll do the rest. Combing through maps, reddit threads and much more for reviews, price, and the optimal distance.</p>
                </div>
              </div>
            
          </div>
          <div className={styles.featureColumnTwo}>
            <div className={styles.featureTwo}>
              <div className={styles.featureTwoTitle}>
                <h4>Share with friends</h4>
              </div>
            </div>
            <div className={styles.featureThree}>
              <div className={styles.featureThreeTitle}>
                <h4>Enjoy your journey</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <Footer/>
    </div>
  );
}