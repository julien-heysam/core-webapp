"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Send,
  Loader2,
  Trash2,
  MessageSquare,
  Wrench,
  ChevronRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  id: string;
  result?: string;
  elapsed?: number;
  status: "running" | "done";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

function ChatMarkdown({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`chat-markdown text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-background/90 p-3 text-xs font-mono border border-border/50">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full min-w-[200px] text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border/50 px-3 py-2">{children}</td>,
          tr: ({ children }) => <tr className="last:border-b-0">{children}</tr>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1.5 mt-2 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-medium">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const EXAMPLE_PROMPTS = [
  "Why did post-processing fail for bot [bot_id]?",
  "Show me the last 10 meetings for org heysam",
  "What tasks are missing for bot [bot_id]?",
  "Check the CRM match status for deal [deal_id]",
  "Search Pinecone for 'pricing discussion' in deal_meeting namespace",
  "List all scheduled trackers",
  "What's the SPICED summary for deal [deal_id]?",
  "Run: SELECT COUNT(*) FROM bot WHERE org_id = 'heysam' AND created_at > NOW() - INTERVAL '7 days'",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("heysam-chat-history");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // ignore corrupted history
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("heysam-chat-history", JSON.stringify(messages));
    }
  }, [messages, hydrated]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, activeToolCalls, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStatusText("Connecting...");
    setActiveToolCalls([]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, stream: true }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ content: "Stream failed" }));
        setMessages([...newMessages, { role: "assistant", content: errData.content || errData.error || "Error" }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";
      const allToolCalls: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              handleSSEEvent(eventType, data, newMessages, allToolCalls);
            } catch {
              /* ignore parse errors */
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages([
          ...newMessages,
          { role: "assistant", content: "Sorry, I encountered an error. Please check the backend and try again." },
        ]);
      }
    } finally {
      setLoading(false);
      setStatusText("");
      setActiveToolCalls([]);
      abortRef.current = null;
    }
  }

  function handleSSEEvent(
    eventType: string,
    data: Record<string, unknown>,
    baseMessages: Message[],
    allToolCalls: ToolCall[]
  ) {
    switch (eventType) {
      case "status":
        setStatusText(data.message as string);
        break;

      case "tool_call": {
        const tc: ToolCall = {
          name: data.name as string,
          arguments: data.arguments as Record<string, unknown>,
          id: data.id as string,
          status: "running",
        };
        allToolCalls.push(tc);
        setActiveToolCalls([...allToolCalls]);
        setStatusText(`Running ${data.name}...`);
        break;
      }

      case "tool_result": {
        const idx = allToolCalls.findIndex((t) => t.id === data.id);
        if (idx !== -1) {
          allToolCalls[idx].result = data.preview as string;
          allToolCalls[idx].elapsed = data.elapsed_seconds as number;
          allToolCalls[idx].status = "done";
          setActiveToolCalls([...allToolCalls]);
        }
        break;
      }

      case "content":
      case "done": {
        const content = data.content as string;
        const assistantMsg: Message = {
          role: "assistant",
          content,
          toolCalls: allToolCalls.length > 0 ? [...allToolCalls] : undefined,
        };
        setMessages([...baseMessages, assistantMsg]);
        break;
      }

      case "error":
        setMessages([
          ...baseMessages,
          { role: "assistant", content: `Error: ${data.message}` },
        ]);
        break;
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem("heysam-chat-history");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debug Chat</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI assistant with 18 tools: database, bots, deals, Pinecone, trackers, and more
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearHistory} className="shrink-0">
          <Trash2 className="mr-2 h-4 w-4" />
          Clear history
        </Button>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6"
        >
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[280px] gap-6 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold">HeySam Debug Assistant</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Ask about bots, deals, orgs, Pinecone, trackers, or run SQL. 18 tools available.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="text-left text-sm px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-accent-foreground/20 transition-colors break-words"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className="animate-in fade-in-50 duration-300">
                <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <Avatar className="h-9 w-9 shrink-0 ring-2 ring-border/50">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">HS</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted/80 border border-border/50"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <ChatMarkdown content={msg.content} />
                    ) : (
                      <ChatMarkdown content={msg.content} className="text-primary-foreground [&_code]:bg-primary-foreground/20 [&_pre]:bg-primary-foreground/10" />
                    )}
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="h-9 w-9 shrink-0 ring-2 ring-border/50">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">You</AvatarFallback>
                    </Avatar>
                  )}
                </div>

                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="ml-12 mt-3">
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 rounded hover:bg-muted/50 px-2 -ml-2">
                        <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
                        <Wrench className="h-3 w-3" />
                        {msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? "s" : ""} used
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-1.5">
                          {msg.toolCalls.map((tc) => (
                            <ToolCallCard key={tc.id} toolCall={tc} />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="space-y-3 animate-in fade-in-50 duration-200">
                <div className="flex gap-3">
                  <Avatar className="h-9 w-9 shrink-0 ring-2 ring-border/50">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">HS</AvatarFallback>
                  </Avatar>
                  <div className="rounded-xl bg-muted/80 border border-border/50 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{statusText || "Thinking..."}</span>
                    </div>
                  </div>
                </div>

                {activeToolCalls.length > 0 && (
                  <div className="ml-11 space-y-1.5">
                    {activeToolCalls.map((tc) => (
                      <ToolCallCard key={tc.id} toolCall={tc} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <CardContent className="border-t p-4">
          <div className="flex gap-2 rounded-lg border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Textarea
              placeholder="Ask about bots, deals, orgs, Pinecone, trackers, or run queries..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent px-3 py-2 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-10 w-10 shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/50 bg-background/60 text-xs shadow-sm">
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        {toolCall.status === "running" ? (
          <Clock className="h-3 w-3 text-yellow-500 animate-pulse" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        )}
        <span className="font-mono font-medium">{toolCall.name}</span>
        <span className="text-muted-foreground">
          ({Object.entries(toolCall.arguments).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")})
        </span>
        {toolCall.elapsed != null && (
          <span className="ml-auto text-muted-foreground">{toolCall.elapsed}s</span>
        )}
        <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && toolCall.result && (
        <div className="border-t border-border/50 px-3 py-2.5 bg-muted/30 rounded-b-lg">
          <pre className="whitespace-pre-wrap break-all text-muted-foreground max-h-[200px] overflow-auto text-xs font-mono">
            {toolCall.result}
          </pre>
        </div>
      )}
    </div>
  );
}
