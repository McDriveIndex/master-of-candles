import PhaserGame from "@/components/PhaserGame/PhaserGame";

import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Master of Candles</h1>
        <p className={styles.subtitle}>SPACE to play, ESC for game over, SPACE to restart.</p>
        <div className={styles.gameArea}>
          <PhaserGame />
        </div>
      </main>
    </div>
  );
}
