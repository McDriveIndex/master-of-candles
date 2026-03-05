import styles from "./MasterLayer.module.css";

export default function MasterLayer() {
  return (
    <div className={styles.layer} aria-hidden="true">
      <div className={styles.masterBreath}>
        <div className={styles.hoodWrap}>
          <img
            src="/master_hood.png"
            alt="Master hood"
            draggable={false}
            className={styles.hood}
          />
          <img
            src="/eyes_glow.png"
            alt="Master glowing eyes"
            draggable={false}
            className={`${styles.eyesGlow} ${styles.eyesPulse}`}
          />
        </div>
        <img
          src="/hand_left.png"
          alt="Master left hand"
          draggable={false}
          className={styles.handLeft}
        />
        <img
          src="/hand_right.png"
          alt="Master right hand"
          draggable={false}
          className={styles.handRight}
        />
      </div>
    </div>
  );
}
