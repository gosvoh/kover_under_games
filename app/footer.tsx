import Link from "next/link";
import styles from "./footer.module.scss";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p>
        Сделано{" "}
        <span>
          <Link href="https://github.com/gosvoh">gosvoh</Link>
        </span>{" "}
        специально для{" "}
        <span>
          <Link href="https://www.twitch.tv/kover_undercover">
            Kover_UnderCover
          </Link>
        </span>
      </p>
    </footer>
  );
}
