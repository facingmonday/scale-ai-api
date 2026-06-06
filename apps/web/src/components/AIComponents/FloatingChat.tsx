import React, { useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import aiService from "../../services/ai";
import {
  AssistantModalPrimitive,
  AssistantRuntimeProvider,
  useLocalRuntime,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { Bot } from "lucide-react";

const FloatingChat: React.FC = () => {
  const { activeClassroom } = useAuth();
  const classroomId = activeClassroom?._id ?? null;

  // Define the model adapter connected to our streamChat service
  const modelAdapter = useMemo(() => ({
    async *run({ messages }: { messages: readonly any[] }) {
      if (!classroomId) return;

      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const prompt = lastUserMsg?.content?.[0]?.text || "";
      if (!prompt) return;

      const queue: string[] = [];
      let resolveNext: ((value: boolean) => void) | null = null;
      let isDone = false;
      let error: Error | null = null;

      aiService.streamChat(classroomId, prompt, (chunk) => {
        queue.push(chunk);
        if (resolveNext) {
          resolveNext(true);
          resolveNext = null;
        }
      })
      .then(() => {
        isDone = true;
        if (resolveNext) {
          resolveNext(false);
          resolveNext = null;
        }
      })
      .catch((err) => {
        error = err;
        if (resolveNext) {
          resolveNext(false);
          resolveNext = null;
        }
      });

      let accumulatedText = "";
      while (true) {
        if (queue.length > 0) {
          accumulatedText += queue.shift()!;
          yield {
            content: [{ type: "text" as const, text: accumulatedText }],
          };
          continue;
        }
        if (isDone) {
          break;
        }
        if (error) {
          throw error;
        }
        const hasMore = await new Promise<boolean>((resolve) => {
          resolveNext = resolve;
        });
        if (!hasMore) {
          break;
        }
      }
    }
  }), [classroomId]);

  // Initialize assistant-ui local runtime
  const runtime = useLocalRuntime(modelAdapter);

  // Sync chat history from the backend whenever the classroom changes
  useEffect(() => {
    if (!classroomId) return;

    const loadHistory = async () => {
      try {
        const data = await aiService.getChatHistory(classroomId);
        if (data && Array.isArray(data.history)) {
          const mapped = data.history.map((msg: any) => ({
            role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
            content: [{ type: "text" as const, text: msg.content }]
          }));
          runtime.threads.main.reset(mapped);
        } else {
          runtime.threads.main.reset([]);
        }
      } catch (err: any) {
        console.error("Failed to load history:", err);
        runtime.threads.main.reset([]);
      }
    };

    void loadHistory();
  }, [classroomId, runtime]);

  if (!classroomId) return null;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantModalPrimitive.Root>
        <AssistantModalPrimitive.Anchor className="fixed right-4 bottom-4 size-11 z-[9999]">
          <AssistantModalPrimitive.Trigger asChild>
            <button className="size-full rounded-full bg-primary text-primary-foreground shadow hover:scale-110 active:scale-90 flex items-center justify-center cursor-pointer transition-all">
              <Bot className="size-6" />
            </button>
          </AssistantModalPrimitive.Trigger>
        </AssistantModalPrimitive.Anchor>

        <AssistantModalPrimitive.Content
          sideOffset={16}
          className="h-[500px] w-[400px] rounded-xl border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out z-[9999] overflow-hidden flex flex-col"
        >
          <Thread />
        </AssistantModalPrimitive.Content>
      </AssistantModalPrimitive.Root>
    </AssistantRuntimeProvider>
  );
};

export default FloatingChat;
