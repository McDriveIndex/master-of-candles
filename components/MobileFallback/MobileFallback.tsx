import styles from "./MobileFallback.module.css";

export default function MobileFallback() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.centerFade} aria-hidden="true" />
      <div className={styles.signal}>
        <img
          src="/mobile_message.png"
          alt="Proper trader setup required. Open on desktop."
          draggable={false}
          className={styles.messageImage}
        />
      </div>
    </div>
  );
}
