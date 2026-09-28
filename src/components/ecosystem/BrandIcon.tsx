import type { IconType } from "react-icons";
import {
  SiInstagram,
  SiWhatsapp,
  SiGmail,
  SiTelegram,
  SiGoogledrive,
  SiClickup,
  SiGooglecalendar,
  SiTiktok,
  SiN8N,
  SiNotion,
  SiYoutube,
  SiX,
} from "react-icons/si";
import { FaSlack, FaLinkedin } from "react-icons/fa6";

export const BRAND_ICONS: Record<string, IconType> = {
  instagram: SiInstagram,
  whatsapp: SiWhatsapp,
  gmail: SiGmail,
  telegram: SiTelegram,
  drive: SiGoogledrive,
  clickup: SiClickup,
  calendar: SiGooglecalendar,
  tiktok: SiTiktok,
  n8n: SiN8N,
  slack: FaSlack,
  notion: SiNotion,
  youtube: SiYoutube,
  linkedin: FaLinkedin,
  x: SiX,
};

/** Renders a real brand SVG icon (falls back to a plain dot if unknown). */
export function BrandIcon({ id, color, size = 16 }: { id: string; color: string; size?: number }) {
  const Icon = BRAND_ICONS[id];
  if (!Icon) return <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block" }} />;
  return <Icon color={color} size={size} />;
}
