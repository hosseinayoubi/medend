import ChatScreen from "@/components/chat/ChatScreen";

export default function RecipeChatPage() {
  return (
    <ChatScreen
      mode="recipe"
      title="Recipe Chat"
      subtitle="Tell me ingredients or cravings—I'll suggest a recipe."
    />
  );
}
