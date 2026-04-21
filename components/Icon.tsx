import type { ReactElement } from "react";

type IconProps = { className?: string; style?: React.CSSProperties };

function make(d: React.ReactNode) {
  const Component = (props?: IconProps) => (
    <svg className={props?.className ?? "v2-icon"} viewBox="0 0 24 24" style={props?.style}>
      {d}
    </svg>
  );
  return Component;
}

export const Icon = {
  home: make(<path d="M3 12l9-9 9 9M5 10v10h14V10" />),
  inbox: make(
    <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />,
  ),
  chart: make(<path d="M3 3v18h18M7 14l4-4 4 4 5-5" />),
  mail: make(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 6l-10 7L2 6" />
    </>,
  ),
  send: make(<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />),
  settings: make(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>,
  ),
  phone: make(
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </>,
  ),
  zap: make(<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />),
  card: make(
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>,
  ),
  building: make(
    <>
      <rect x="4" y="2" width="16" height="20" rx="1" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </>,
  ),
  file: make(
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </>,
  ),
  pkg: make(
    <>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </>,
  ),
  play: make(<path d="M5 3l14 9-14 9V3z" />),
  bank: make(<path d="M3 10h18M5 10l7-6 7 6M6 10v8M10 10v8M14 10v8M18 10v8M3 21h18" />),
  check: make(<path d="M20 6L9 17l-5-5" />),
  clock: make(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>,
  ),
  x: make(<path d="M18 6L6 18M6 6l12 12" />),
  arrow: make(<path d="M5 12h14M12 5l7 7-7 7" />),
  up: make(<path d="M7 17l10-10M7 7h10v10" />),
  down: make(<path d="M7 7l10 10M17 7v10H7" />),
  plus: make(<path d="M12 5v14M5 12h14" />),
  search: make(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </>,
  ),
  sparkle: make(<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />),
  alert: make(<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />),
  trash: make(
    <>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6v14a2 2 0 002 2h8a2 2 0 002-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>,
  ),
  refresh: make(
    <>
      <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>,
  ),
};

export type IconName = keyof typeof Icon;
export type IconEl = ReactElement;

export const CAT_COLOR: Record<string, string> = {
  servicios: "#2563eb",
  tarjeta: "#dc2626",
  expensas: "#d97706",
  impuestos: "#7c3aed",
  compras: "#db2777",
  suscrip: "#16a34a",
  debito: "#737373",
  familia: "#0891b2",
  calu: "#ca8a04",
  prestamo: "#4f46e5",
};

const familiaIcon = make(
  <>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </>,
);

const caluIcon = make(
  <>
    <circle cx="11" cy="4" r="2" />
    <circle cx="18" cy="8" r="2" />
    <circle cx="20" cy="14" r="2" />
    <circle cx="4" cy="14" r="2" />
    <path d="M8 14a4 4 0 00-4 6c0 1 1 2 2 2h10c1 0 2-1 2-2a4 4 0 00-4-6 2 2 0 01-2 0 2 2 0 01-2 0 2 2 0 01-2 0z" />
  </>,
);

const prestamoIcon = make(
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </>,
);

export const CAT_ICON: Record<string, (props?: IconProps) => ReactElement> = {
  servicios: Icon.zap,
  tarjeta: Icon.card,
  expensas: Icon.building,
  impuestos: Icon.file,
  compras: Icon.pkg,
  suscrip: Icon.play,
  debito: Icon.bank,
  familia: familiaIcon,
  calu: caluIcon,
  prestamo: prestamoIcon,
};
