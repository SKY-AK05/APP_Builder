"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import JSZip from "jszip";
import { ArrowLeft, Bot, FileCode, Play, Loader2, Sparkles, Terminal, CheckCircle2, XCircle, Wand2, Folder, File as FileIcon, Search, User, CornerDownLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { determineImportantRequirement } from "@/ai/flows/determine-important-requirement";
import { generateFlutterApp, GenerateFlutterAppOutput } from "@/ai/flows/generate-flutter-app";
import { CodeDisplay } from "@/components/code-display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from "react-resizable-panels";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  prompt: z
    .string()
    .min(10, { message: "Please describe your app in at least 10 characters." })
    .max(500, { message: "Prompt must not be longer than 500 characters." }),
});

type ActiveTab = 'main.dart' | 'pubspec.yaml' | 'logs' | 'preview';
type BuildStatus = 'idle' | 'zipping' | 'uploading' | 'building' | 'success' | 'error';
type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const BUILD_SERVER_URL = "http://localhost:3001/api/flutter-build"; 
const PREVIEW_URL_BASE = "http://localhost:3001/builds"; 

export default function BuildPage() {
  const [generatedCode, setGeneratedCode] = useState<GenerateFlutterAppOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Generating...");
  const [isVaguePrompt, setIsVaguePrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('main.dart');
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle');
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const { toast } = useToast();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [buildLogs]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const startBuildProcess = async (code: GenerateFlutterAppOutput) => {
      setBuildStatus('zipping');
      setChatHistory(prev => [...prev, { role: 'system', content: 'Zipping project files...' }]);
      setBuildLogs(['Zipping project files...']);
      const zip = new JSZip();
      
      const projectFolder = zip.folder("project");
      if (!projectFolder) {
        setBuildStatus('error');
        setBuildLogs(logs => [...logs, '---', `An error occurred: Failed to create zip folder.`]);
        setChatHistory(prev => [...prev, { role: 'system', content: 'Error: Failed to create zip folder.' }]);
        return;
      }
      projectFolder.file("lib/main.dart", code.mainDart);
      projectFolder.file("pubspec.yaml", code.pubspec);
      
      try {
        const content = await zip.generateAsync({ type: "blob" });
        setBuildStatus('uploading');
        setBuildLogs(logs => [...logs, 'Uploading to build server...']);
        setChatHistory(prev => [...prev, { role: 'system', content: 'Uploading to build server...' }]);
        
        const formData = new FormData();
        formData.append("file", content, "project.zip");
        
        const response = await fetch(BUILD_SERVER_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Build server failed with status ${response.status}: ${await response.text()}`);
        }
        
        const { buildId } = await response.json();
        setBuildStatus('building');
        setBuildLogs(logs => [...logs, `Build started with ID: ${buildId}`, '---']);
        setChatHistory(prev => [...prev, { role: 'system', content: `Build started (ID: ${buildId}). Streaming logs...` }]);
        
        const buildServerHost = new URL(BUILD_SERVER_URL).host;
        const wsProtocol = new URL(BUILD_SERVER_URL).protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${buildServerHost}/logs?buildId=${buildId}`;

        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log("WebSocket connection established.");
            setBuildLogs(logs => [...logs, 'Connected to build server logs...']);
        };

        socket.onmessage = (event) => {
            const message = event.data;
            if (typeof message === 'string') {
                const newLogs = message.split('\n').filter(log => log.trim() !== '');
                if (message.includes("BUILD_SUCCESS")) {
                    setPreviewUrl(`${PREVIEW_URL_BASE}/${buildId}/project/build/web/index.html`);
                    setBuildStatus('success');
                    setActiveTab('preview');
                    setBuildLogs(logs => [...logs, '---', 'Build successful!']);
                    setChatHistory(prev => [...prev, { role: 'system', content: 'Build successful! Preview is now available.' }]);
                    socket.close();
                } else if (message.includes("BUILD_ERROR")) {
                    setBuildStatus('error');
                    setBuildLogs(logs => [...logs, '---', 'Build failed. See logs for details.']);
                    setChatHistory(prev => [...prev, { role: 'system', content: 'Build failed. Check the logs for more details.' }]);
                    socket.close();
                } else {
                    setBuildLogs(logs => [...logs, ...newLogs]);
                }
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            setBuildStatus('error');
            setBuildLogs(logs => [...logs, '---', 'Error connecting to build logs. Is your build server running?']);
            setChatHistory(prev => [...prev, { role: 'system', content: 'Error connecting to build server. Please check if it is running.' }]);
        };

        socket.onclose = () => {
            console.log("WebSocket connection closed.");
             if(buildStatus !== 'success' && buildStatus !== 'error') {
                setBuildStatus('error');
                setBuildLogs(logs => [...logs, '---', 'Connection to build logs closed unexpectedly.']);
                setChatHistory(prev => [...prev, { role: 'system', content: 'Connection to build logs closed unexpectedly.' }]);
             }
        };

      } catch (error: any) {
          setBuildStatus('error');
          setBuildLogs(logs => [...logs, '---', `An error occurred: ${error.message}`]);
          setChatHistory(prev => [...prev, { role: 'system', content: `An error occurred: ${error.message}` }]);
           toast({
              variant: "destructive",
              title: "Build Failed",
              description: "Could not connect to the build server. Please ensure it's running and accessible.",
           });
      }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsGenerating(true);
    setGeneratedCode(null);
    setIsVaguePrompt(false);
    setBuildStatus('idle');
    setBuildLogs([]);
    setPreviewUrl(null);
    setActiveTab('main.dart');
    setChatHistory([{ role: 'user', content: values.prompt }]);
    form.reset();

    try {
      setLoadingMessage("Analyzing requirements...");
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Analyzing requirements...' }]);
      const requirementCheck = await determineImportantRequirement({
        userRequest: values.prompt,
      });

      if (!requirementCheck.hasImportantRequirement) {
        setIsVaguePrompt(true);
        setIsGenerating(false);
        setChatHistory(prev => [...prev, { role: 'assistant', content: "Your request is a bit vague. Try adding more specific details for a better result." }]);
        return;
      }

      setLoadingMessage("Generating Flutter project...");
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Requirements look good! Generating Flutter project...' }]);
      const codeResult = await generateFlutterApp({ userPrompt: values.prompt });
      setGeneratedCode(codeResult);
      setActiveTab('main.dart');
      
      startBuildProcess(codeResult);

    } catch (error: any) {
      console.error("Error generating app:", error);
      const errorMessage = error.message || "An unknown error occurred.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: `An error occurred during generation: ${errorMessage}` }]);

      if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("overloaded")) {
         toast({
          variant: "destructive",
          title: "AI Service Unavailable",
          description:
            "The AI model is currently overloaded. Please wait a moment and try again.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Oh no! Something went wrong.",
          description:
            "There was a problem generating your app. Please try again.",
        });
      }
      setBuildStatus('error');
    } finally {
      setIsGenerating(false);
    }
  }

  const renderBuildStatus = () => {
    switch(buildStatus) {
        case 'zipping': return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Zipping...</>;
        case 'uploading': return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>;
        case 'building': return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building...</>;
        case 'success': return <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />Build Succeeded</>;
        case 'error': return <><XCircle className="mr-2 h-4 w-4 text-red-500" />Build Failed</>;
        default: return <>Idle</>;
    }
  };

  const isLoading = isGenerating || (buildStatus !== 'idle' && buildStatus !== 'success' && buildStatus !== 'error');

  const renderMessage = (msg: ChatMessage, index: number) => {
    const icon = msg.role === 'user' ? <User className="h-5 w-5 text-primary" /> : <Bot className="h-5 w-5 text-primary" />;
    const bgColor = msg.role === 'user' ? 'bg-transparent' : 'bg-slate-900';
    const alignment = msg.role === 'user' ? 'justify-end' : 'justify-start';

    return (
        <div key={index} className={`flex items-start gap-3 my-4 ${alignment}`}>
            {msg.role !== 'user' && icon}
            <div className={`rounded-lg p-3 max-w-[85%] ${bgColor}`}>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && icon}
        </div>
    );
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800 bg-slate-950 px-4 sm:px-6">
        <Button variant="outline" size="icon" className="h-8 w-8" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Home</span>
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">AI App Builder</h1>
        <div className="ml-auto flex items-center gap-2">
           <span className="text-sm text-muted-foreground">Status:</span>
           <div className="flex items-center gap-2 text-sm">{renderBuildStatus()}</div>
        </div>
      </header>
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={30} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex-1 flex flex-col p-4 gap-4">
              <ScrollArea className="flex-1" ref={chatContainerRef}>
                  <div className="pr-4">
                  {chatHistory.length === 0 && (
                      <div className="flex h-full items-center justify-center">
                          <p className="text-muted-foreground">Start by describing your app below.</p>
                      </div>
                  )}
                  {chatHistory.map(renderMessage)}
                  </div>
              </ScrollArea>
              <div className="mt-auto">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                      <FormField
                          control={form.control}
                          name="prompt"
                          render={({ field }) => (
                              <FormItem>
                                  <FormControl>
                                      <div className="relative">
                                          <Textarea
                                              placeholder="e.g., 'A simple todo list app...'"
                                              className="min-h-[80px] resize-none pr-12"
                                              {...field}
                                              onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && !e.shiftKey) {
                                                      e.preventDefault();
                                                      form.handleSubmit(onSubmit)();
                                                  }
                                              }}
                                          />
                                          <Button type="submit" size="icon" className="absolute bottom-3 right-3 h-8 w-8" disabled={isLoading}>
                                              <CornerDownLeft className="h-4 w-4" />
                                              <span className="sr-only">Submit</span>
                                          </Button>
                                      </div>
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                  </form>
                </Form>
              </div>
            </div>
            <PanelResizeHandle className="w-px bg-slate-800" />
            <div className="h-[40%] border-t border-slate-800 flex flex-col">
                <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2">Files</h3>
                    <div className="relative">
                        <Input placeholder="Search Files" className="pl-8 bg-slate-900 border-slate-700"/>
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                </div>
                <ScrollArea className="flex-1 px-4">
                    <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 p-1 rounded-md text-slate-300">
                            <Folder className="h-4 w-4"/>
                            <span>project</span>
                        </div>
                         <div className="ml-4 flex items-center gap-2 p-1 rounded-md text-slate-300">
                            <Folder className="h-4 w-4"/>
                            <span>lib</span>
                        </div>
                         <button
                            onClick={() => setActiveTab('main.dart')}
                            disabled={!generatedCode}
                            className="w-full text-left ml-8 flex items-center gap-2 p-1 rounded-md text-slate-300 hover:bg-slate-800 disabled:opacity-50 data-[active=true]:bg-slate-800"
                            data-active={activeTab === 'main.dart'}
                         >
                            <FileIcon className="h-4 w-4 text-slate-400"/>
                            <span>main.dart</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('pubspec.yaml')}
                            disabled={!generatedCode}
                            className="w-full text-left ml-4 flex items-center gap-2 p-1 rounded-md text-slate-300 hover:bg-slate-800 disabled:opacity-50 data-[active=true]:bg-slate-800"
                            data-active={activeTab === 'pubspec.yaml'}
                         >
                            <FileIcon className="h-4 w-4 text-slate-400"/>
                            <span>pubspec.yaml</span>
                        </button>
                    </div>
                </ScrollArea>
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-slate-800 hover:bg-slate-700" />
        <Panel defaultSize={70} minSize={30}>
            <div className="h-full flex flex-col">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="w-full flex-1 flex flex-col">
                    <TabsList className="m-2 bg-slate-900">
                        <TabsTrigger value="main.dart" disabled={!generatedCode}><FileCode className="mr-2 h-4 w-4"/>main.dart</TabsTrigger>
                        <TabsTrigger value="pubspec.yaml" disabled={!generatedCode}><FileCode className="mr-2 h-4 w-4"/>pubspec.yaml</TabsTrigger>
                        <TabsTrigger value="logs"><Terminal className="mr-2 h-4 w-4" />Logs</TabsTrigger>
                        <TabsTrigger value="preview" disabled={buildStatus !== 'success'}><Play className="mr-2 h-4 w-4" />Preview</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-y-auto p-2">
                        <TabsContent value="main.dart" className="m-0 h-full">
                            <CodeDisplay code={generatedCode?.mainDart ?? "/*\n * Your generated main.dart code will appear here.\n * Describe your app in the chat on the left.\n */"} />
                        </TabsContent>
                        <TabsContent value="pubspec.yaml" className="m-0 h-full">
                            <CodeDisplay code={generatedCode?.pubspec ?? "# Your generated pubspec.yaml will appear here."} />
                        </TabsContent>
                        <TabsContent value="logs" className="m-0 h-full">
                            <div ref={logContainerRef} className="w-full h-full rounded-lg bg-slate-900 text-slate-100 font-mono text-sm p-4 overflow-y-auto">
                                {buildLogs.length > 0 ? buildLogs.map((log, i) => (
                                    <div key={i} className="whitespace-pre-wrap">{log}</div>
                                )) : <div className="text-muted-foreground">Build logs will appear here when you generate an app.</div>}
                            </div>
                        </TabsContent>
                        <TabsContent value="preview" className="m-0 h-full">
                            <div className="relative mx-auto w-full h-full rounded-lg border border-slate-800 bg-slate-900 text-card-foreground shadow-sm flex items-center justify-center">
                            {previewUrl ? (
                                <iframe src={previewUrl} className="w-full h-full border-0" title="Flutter App Preview" />
                            ) : (
                                <div className="text-center p-4">
                                    <Play className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">Live Preview</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        The live preview will appear here once the build is complete.
                                    </p>
                                </div>
                            )}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

    