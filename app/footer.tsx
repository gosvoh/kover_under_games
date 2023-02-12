import Link from "next/link";
import styles from "./footer.module.scss";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p>Сделано </p>
      <Link href="https://github.com/gosvoh">gosvoh</Link>
      <p> специально для </p>
      <Link href="https://www.twitch.tv/kover_undercover">
        Kover_UnderCover
      </Link>
    </footer>
  );
}
