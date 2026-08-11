import "server-only";

import type { CSSProperties } from "react";
import Image from "next/image";
import { IBM_Plex_Sans } from "next/font/google";
import QRCode from "qrcode";
import { getSiteOrigin } from "@/src/auth/config";
import {
  formatCertificateDate,
  publicCertificatePath,
} from "./model";
import { certificateNameLayout } from "./name-layout";

const certificateFont = IBM_Plex_Sans({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500"],
  style: "normal",
  display: "swap",
  variable: "--asa-certificate-font",
});

const BACKGROUND_PATH = "/certificate-assets/archstart-certificate-facade-background.png";

export type CertificateArtworkStatus = "VALID" | "REVOKED";

export interface CertificateArtworkProps {
  certificateCode: string;
  courseTitle: string;
  courseVersion: string;
  displayName: string;
  issuedAt: string;
  status: CertificateArtworkStatus;
}

function verificationUrl(certificateCode: string): string {
  return new URL(publicCertificatePath(certificateCode), `${getSiteOrigin()}/`).toString();
}

async function certificateQrDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
  });
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export async function CertificateArtwork({
  certificateCode,
  courseTitle,
  courseVersion,
  displayName,
  issuedAt,
  status,
}: CertificateArtworkProps) {
  const publicUrl = verificationUrl(certificateCode);
  const qrDataUrl = await certificateQrDataUrl(publicUrl);
  const name = certificateNameLayout(displayName);
  const nameStyle = {
    "--asa-certificate-name-size": `${name.fontSizeCqw}cqw`,
  } as CSSProperties;
  const courseLead = "ARCH.START — русскоязычный вводный";
  const courseTail = "курс архитектуры.";
  const fixedCourseIdentity = `${courseLead} курс архитектуры`;
  const courseLines = courseTitle === fixedCourseIdentity
    ? [courseLead, courseTail]
    : [`${courseTitle}.`];

  return (
    <article
      className={`asa-certificate-artwork ${certificateFont.variable}`}
      data-certificate-status={status}
      aria-label={`Сертификат о завершении курса ARCH.START: ${displayName}`}
    >
      <Image
        className="asa-certificate-artwork__background"
        src={BACKGROUND_PATH}
        alt=""
        fill
        sizes="(max-width: 900px) 100vw, 1400px"
        unoptimized
        aria-hidden="true"
      />

      <header className="asa-certificate-artwork__identity">
        <strong>ARCH.START</strong>
        <p>
          Сертификат о завершении курса /
          <br />
          Certificate of Completion
        </p>
      </header>

      <dl className="asa-certificate-artwork__metadata">
        <div>
          <dt>Дата выпуска /</dt>
          <dd>{formatCertificateDate(issuedAt)}</dd>
        </div>
        <div>
          <dt>Версия курса /</dt>
          <dd>{courseVersion}</dd>
        </div>
      </dl>

      <h1
        className={`asa-certificate-artwork__name asa-certificate-artwork__name--${name.scale}`}
        style={nameStyle}
      >
        {name.lines.map((line, index) => <span key={`${index}-${line}`}>{line}</span>)}
      </h1>

      <p className="asa-certificate-artwork__course-title">
        {courseLines.map((line) => <span key={line}>{line}</span>)}
      </p>

      <section className="asa-certificate-artwork__verification" aria-label="Проверка подлинности">
        <a
          className="asa-certificate-artwork__qr-link"
          href={publicUrl}
          aria-label="Открыть публичную проверку сертификата"
        >
          <Image
            className="asa-certificate-artwork__qr"
            src={qrDataUrl}
            width={320}
            height={320}
            alt="QR-код для проверки подлинности сертификата"
            unoptimized
          />
        </a>
        <div>
          <p>
            Проверить подлинность /
            <br />
            Scan to Verify
          </p>
          <code>{certificateCode}</code>
        </div>
      </section>

      <p className="asa-certificate-artwork__disclaimer">
        Сертификат подтверждает завершение некоммерческого образовательного курса ARCH.START.
        <br />
        Он не является государственной аккредитацией, университетским кредитом,
        <br />
        профессиональной лицензией или официальной квалификацией архитектора.
      </p>

      {status === "REVOKED" ? (
        <div className="asa-certificate-artwork__revoked" aria-label="Сертификат отозван">
          <span>ОТОЗВАН</span>
          <span>REVOKED</span>
        </div>
      ) : null}
    </article>
  );
}
