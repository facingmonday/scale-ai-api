import React, { useEffect, useState, useRef } from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import aiService from "../../../services/ai";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "model";
  content: string;
}

const AICoach: React.FC = () => {
  const { activeClassroom } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const classroomId = activeClassroom?._id ?? null;

  // Scroll to bottom whenever messages or streaming response change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingResponse]);

  // Load chat history
  useEffect(() => {
    if (!classroomId) return;

    const loadHistory = async () => {
      try {
        const data = await aiService.getChatHistory(classroomId);
        if (data && Array.isArray(data.history)) {
          setMessages(data.history);
        }
      } catch (err: any) {
        console.error("Failed to load chat history:", err);
        toast.error("Failed to load conversation history.");
      }
    };

    void loadHistory();
  }, [classroomId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !classroomId || isTyping) return;

    const userPrompt = input.trim();
    setInput("");
    
    // Add user message locally first
    const updatedMessages = [...messages, { role: "user", content: userPrompt } as Message];
    setMessages(updatedMessages);
    setIsTyping(true);
    setStreamingResponse("");

    try {
      let accumulatedText = "";
      await aiService.streamChat(classroomId, userPrompt, (chunk) => {
        accumulatedText += chunk;
        setStreamingResponse(accumulatedText);
      });

      // Once finished, append final model message and clear stream status
      setMessages((prev) => [...prev, { role: "model", content: accumulatedText }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      toast.error("Error communicating with AI Coach.");
    } finally {
      setIsTyping(false);
      setStreamingResponse("");
    }
  };

  return (
    <BasicLayout>
      <div className="page max-w-4xl mx-auto w-full flex-grow flex flex-col">
        <div className="container flex-grow flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
          {/* Header */}
          <div className="card mb-4 flex items-center justify-between p-4 flex-shrink-0">
            <div>
              <h1 className="heading-md flex items-center gap-2">
                <i className="pi pi-discord text-brand-teal text-xl" /> AI Coach
              </h1>
              <p className="text-text-muted text-xs mt-1">
                Your supply chain tutor. Ask about your inventory costs, profit drops, and optimal ordering logic.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-brand-teal/10 text-brand-teal">
                Active Classroom: {activeClassroom?.name}
              </span>
            </div>
          </div>

          {/* Chat Container */}
          <div className="card flex-grow overflow-y-auto p-4 mb-4 flex flex-col space-y-4 bg-ui-surface/50 border border-ui-border rounded-xl">
            {messages.length === 0 && !isTyping && (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal mb-4">
                  <i className="pi pi-comments text-3xl" />
                </div>
                <h3 className="font-semibold text-text-primary text-lg">Start a conversation</h3>
                <p className="text-text-secondary text-sm max-w-md mt-1">
                  Ask questions like: "Why did my week 2 profit drop?", "How do I calculate the Economic Order Quantity?", or "What did the demand signals mean?"
                </p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl p-4 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-brand-teal text-brand-dark rounded-br-none"
                      : "bg-ui-muted text-text-primary rounded-bl-none border border-ui-border"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Streaming message bubble */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl rounded-bl-none p-4 text-sm bg-ui-muted text-text-primary border border-ui-border shadow-sm">
                  {streamingResponse || (
                    <span className="flex items-center gap-1">
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce delay-100">●</span>
                      <span className="animate-bounce delay-200">●</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form onSubmit={handleSend} className="flex gap-2 flex-shrink-0">
            <span className="p-input-icon-left flex-grow">
              <i className="pi pi-pencil text-text-secondary pl-3" />
              <InputText
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your AI Coach..."
                className="w-full pl-10 pr-4 py-3 bg-ui-surface border-ui-border text-text-primary rounded-lg focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                disabled={isTyping || !classroomId}
              />
            </span>
            <Button
              type="submit"
              icon="pi pi-send"
              label="Send"
              className="px-6 py-3 bg-brand-teal hover:bg-brand-teal/90 text-brand-dark font-semibold rounded-lg transition"
              disabled={isTyping || !input.trim() || !classroomId}
            />
          </form>
        </div>
      </div>
    </BasicLayout>
  );
};

export default AICoach;
