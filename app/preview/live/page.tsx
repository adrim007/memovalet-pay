import LiveSessionClient from "@/components/LiveSessionClient";

export default function LiveSessionPreviewPage() {
  return (
    <LiveSessionClient
      sessionId="preview-test-session"
      title="Preview Live Session"
      meetingType="general"
      initialStatus="active"
      initialLangCode="it-IT"
      previewMode
    />
  );
}
