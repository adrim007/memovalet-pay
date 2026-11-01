function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildIcsInvite(input: {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description: string;
  url: string;
  organizerEmail: string;
  attendeeEmail: string;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MemoValet//Live Session//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:" + input.uid,
    "DTSTAMP:" + toIcsDate(new Date()),
    "DTSTART:" + toIcsDate(input.start),
    "DTEND:" + toIcsDate(input.end),
    "SUMMARY:" + escapeIcsText(input.title),
    "DESCRIPTION:" + escapeIcsText(input.description),
    "URL:" + input.url,
    "ORGANIZER:mailto:" + input.organizerEmail,
    "ATTENDEE;RSVP=TRUE:mailto:" + input.attendeeEmail,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
