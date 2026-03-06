import styles from "./ChessFloorLayer.module.css";

export default function ChessFloorLayer() {
  return (
    <div className={styles.layer} aria-hidden="true">
      <img
        className={styles.floor}
        src="/chess-floor.png"
        alt=""
        draggable={false}
      />
    </div>
  );
}
