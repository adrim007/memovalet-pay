import {
  siApple,
  siGoogledocs,
  siGmail,
  siGooglecalendar,
  siTrello,
  siNotion,
  siHubspot,
  siGooglemeet,
  siZoom,
} from "simple-icons";

type IconProps = { className?: string };

function SimpleIcon({
  icon,
  className,
}: {
  icon: { path: string; hex: string };
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={`#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  );
}

export function GoogleDocsIcon({ className }: IconProps) {
  return <SimpleIcon icon={siGoogledocs} className={className} />;
}

export function GmailIcon({ className }: IconProps) {
  return <SimpleIcon icon={siGmail} className={className} />;
}

export function AppleIcon({ className }: IconProps) {
  return <SimpleIcon icon={siApple} className={className} />;
}

export function GoogleCalendarIcon({ className }: IconProps) {
  return <SimpleIcon icon={siGooglecalendar} className={className} />;
}

export function TrelloIcon({ className }: IconProps) {
  return <SimpleIcon icon={siTrello} className={className} />;
}

export function NotionIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="white" />
      <path d={siNotion.path} transform="translate(1.2 1.2) scale(0.9)" />
    </svg>
  );
}

export function HubSpotIcon({ className }: IconProps) {
  return <SimpleIcon icon={siHubspot} className={className} />;
}

export function GoogleMeetIcon({ className }: IconProps) {
  return <SimpleIcon icon={siGooglemeet} className={className} />;
}

export function ZoomIcon({ className }: IconProps) {
  return <SimpleIcon icon={siZoom} className={className} />;
}

export function SlackIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M9 2.4a1.65 1.65 0 1 1 3.3 0v4.35H9V2.4Z" fill="#E01E5A" />
      <path d="M2.4 9a1.65 1.65 0 1 1 0-3.3h4.35V9H2.4Z" fill="#36C5F0" />
      <path d="M11.7 9a1.65 1.65 0 1 1 0 3.3H7.35A1.65 1.65 0 0 1 7.35 9h4.35Z" fill="#ECB22E" />
      <path d="M15 21.6a1.65 1.65 0 1 1-3.3 0v-4.35H15V21.6Z" fill="#2EB67D" />
      <path d="M21.6 15a1.65 1.65 0 1 1 0 3.3h-4.35V15h4.35Z" fill="#E01E5A" />
      <path d="M12.3 15a1.65 1.65 0 1 1 0-3.3h4.35A1.65 1.65 0 0 1 16.65 15H12.3Z" fill="#36C5F0" />
      <path
        d="M15 2.4a1.65 1.65 0 1 1 3.3 0v1.65a1.65 1.65 0 0 1-1.65 1.65H15V2.4Z"
        fill="#ECB22E"
      />
      <path
        d="M9 21.6a1.65 1.65 0 1 1-3.3 0v-1.65A1.65 1.65 0 0 1 7.35 18.3H9v3.3Z"
        fill="#2EB67D"
      />
    </svg>
  );
}

export function SalesforceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="9" cy="13.4" r="3" fill="#00A1E0" />
      <circle cx="12.6" cy="10.6" r="3.7" fill="#00A1E0" />
      <circle cx="16.6" cy="12.5" r="3.1" fill="#00A1E0" />
      <rect x="6.8" y="13" width="10.8" height="3.6" rx="1.8" fill="#00A1E0" />
    </svg>
  );
}
