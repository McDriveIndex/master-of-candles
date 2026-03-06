import MatrixBackground from "@/components/MatrixBackground/MatrixBackground";
import PhaserGame from "@/components/PhaserGame/PhaserGame";
import MasterLayer from "@/components/MasterLayer/MasterLayer";

import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <MatrixBackground />
      <main className={`${styles.main} ${styles.contentLayer}`}>
        <div className={styles.stage}>
          <MasterLayer />
          <div className={styles.gameSlot}>
            <PhaserGame />
          </div>
        </div>
      </main>
    </div>
  );
}
