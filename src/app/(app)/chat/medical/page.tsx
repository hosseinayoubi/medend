import ChatScreen from "@/components/chat/ChatScreen";

export default function MedicalChatPage() {
  return (
    <ChatScreen
      mode="medical"
      title="Medical Chat"
      subtitle="Ask health questions. This is not a diagnosis."
    />
  );
}
