"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import JSZip from "jszip";
import {
  Bot,
  FileCode,
  Play,
  Loader2,
  Sparkles,
  Terminal,
  CheckCircle2,
  XCircle,
  Wand2,
  Folder,
  File as FileIcon,
  Search,
  User,
  CornerDownLeft,
  ChevronDown,
  Github,
  Users,
  Code,
  Zap,
  MessageCircle,
  Plus,
  RotateCcw,
  X,
  FolderOpen
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { determineImportantRequirement } from "@/ai/flows/determine-important-requirement";
import { enhanceUserPrompt } from "@/ai/flows/enhance-user-prompt";
import { generateFlutterApp, GenerateFlutterAppOutput } from "@/ai/flows/generate-flutter-app";
import { CodeDisplay } from "@/components/code-display";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from "react-resizable-panels";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";

const formSchema = z.object({
  prompt: z
    .string()
    .min(1, { message: "Prompt cannot be empty." })
    .max(500, { message: "Prompt must not be longer than 500 characters." }),
});

type FileName = 'main.dart' | 'pubspec.yaml';
type SpecialTab = 'logs' | 'preview';
type ActiveTab = FileName | SpecialTab;

type BuildStatus = 'idle' | 'zipping' | 'uploading' | 'building' | 'success' | 'error';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const BUILD_SERVER_URL = "http://localhost:3001/api/flutter-build"; 
const PREVIEW_URL_BASE = "http://localhost:3001/builds"; 

function BuildPageContent() {
  const searchParams = useSearchParams();
  const [generatedCode, setGeneratedCode] = useState<GenerateFlutterAppOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [openTabs, setOpenTabs] = useState<FileName[]>(['main.dart']);
  const [activeTab, setActiveTab] = useState<ActiveTab | null>('main.dart');

  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle');
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
      { role: 'assistant', content: "I'll help you create a Flutter application. What would you like to build?"}
  ]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const { toast } = useToast();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });

  const handleFormSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsGenerating(true);
    setGeneratedCode(null);
    setOpenTabs([]);
    setActiveTab(null);
    setBuildStatus('idle');
    setBuildLogs([]);
    setPreviewUrl(null);
    setChatHistory(prev => [...prev, { role: 'user', content: values.prompt }]);
    form.reset();

    addSystemMessage("Analyzing requirements...");

    try {
      const requirementCheck = await determineImportantRequirement({
        userRequest: values.prompt,
      });

      let finalPrompt = values.prompt;

      if (!requirementCheck.hasImportantRequirement) {
        addSystemMessage("Request is a bit vague, enhancing it with more details...");
        const enhancedResult = await enhanceUserPrompt({ userRequest: values.prompt });
        finalPrompt = enhancedResult.enhancedPrompt;
        addSystemMessage(`New prompt: "${finalPrompt}"`);
      }


      addSystemMessage("Requirements look good! Generating Flutter project...");
      const codeResult = await generateFlutterApp({ userPrompt: finalPrompt });
      setGeneratedCode(codeResult);
      handleFileClick('main.dart');
      
      await startBuildProcess(codeResult);

    } catch (error: any) {
      console.error("Error generating app:", error);
      const errorMessage = error.message || "An unknown error occurred.";
      addSystemMessage(`An error occurred during generation: ${errorMessage}`);
      setBuildStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const initialPromptRef = useRef(searchParams.get('prompt'));
  
  useEffect(() => {
    if (initialPromptRef.current && chatHistory.length === 1) {
      form.setValue('prompt', initialPromptRef.current);
      handleFormSubmit({ prompt: initialPromptRef.current });
      initialPromptRef.current = null; // Prevent re-submission
    }
  }, []);


  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [buildLogs]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [chatHistory]);

  const handleFileClick = (file: FileName) => {
    if (!generatedCode) return;
    if (!openTabs.includes(file)) {
      setOpenTabs(prev => [...prev, file]);
    }
    setActiveTab(file);
  };

  const handleCloseTab = (tabToClose: FileName, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newTabs = openTabs.filter(tab => tab !== tabToClose);
    setOpenTabs(newTabs);

    if (activeTab === tabToClose) {
      if (newTabs.length > 0) {
        setActiveTab(newTabs[newTabs.length - 1]);
      } else if (openTabs.includes('logs')) {
        setActiveTab('logs');
      } else {
        setActiveTab(null);
      }
    }
  };

  const startBuildProcess = async (code: GenerateFlutterAppOutput) => {
      setBuildStatus('zipping');
      addSystemMessage('Zipping project files...');
      setBuildLogs(['Zipping project files...']);
      setActiveTab('logs');
      const zip = new JSZip();
      
      const projectFolder = zip.folder("project");
      if (!projectFolder) {
        setBuildStatus('error');
        setBuildLogs(logs => [...logs, '---', 'An error occurred: Failed to create zip folder.']);
        addSystemMessage('Error: Failed to create zip folder.');
        return;
      }
      projectFolder.file("lib/main.dart", code.mainDart);
      projectFolder.file("pubspec.yaml", code.pubspec);
      
      try {
        const content = await zip.generateAsync({ type: "blob" });
        setBuildStatus('uploading');
        setBuildLogs(logs => [...logs, 'Uploading to build server...']);
        addSystemMessage('Uploading to build server...');
        
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
        addSystemMessage(`Build started (ID: ${buildId}). Streaming logs...`);
        
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
                    addSystemMessage('Build successful! Preview is now available.');
                    socket.close();
                } else if (message.includes("BUILD_ERROR")) {
                    setBuildStatus('error');
                    setBuildLogs(logs => [...logs, '---', 'Build failed. See logs for details.']);
                    addSystemMessage('Build failed. Check the logs for more details.');
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
            addSystemMessage('Error connecting to build server. Please check if it is running.');
        };

        socket.onclose = () => {
             console.log("WebSocket connection closed.");
             if(buildStatus !== 'success' && buildStatus !== 'error') {
                setBuildStatus('error');
                setBuildLogs(logs => [...logs, '---', 'Connection to build logs closed unexpectedly.']);
                addSystemMessage('Connection to build logs closed unexpectedly.');
             }
        };

      } catch (error: any) {
          setBuildStatus('error');
          setBuildLogs(logs => [...logs, '---', `An error occurred: ${error.message}`]);
          addSystemMessage(`An error occurred: ${error.message}`);
           toast({
              variant: "destructive",
              title: "Build Failed",
              description: "Could not connect to the build server. Please ensure it's running and accessible.",
           });
      }
  }

  const addSystemMessage = (content: string) => {
    setChatHistory(prev => [...prev, { role: 'system', content }]);
  }
  
  const isLoading = isGenerating || (buildStatus !== 'idle' && buildStatus !== 'success' && buildStatus !== 'error');

  const renderMessage = (msg: ChatMessage, index: number) => {
    const isUser = msg.role === 'user';
    const isAssistant = msg.role === 'assistant';
    const isSystem = msg.role === 'system';

    if (isSystem) {
        return (
            <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground my-4">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>{msg.content}</span>
            </div>
        )
    }

    return (
        <div key={index} className={`rounded-lg p-3 ${isUser ? 'bg-muted' : 'bg-primary/10'}`}>
            <div className={`text-xs mb-1 font-semibold ${isUser ? 'text-foreground' : 'text-primary'}`}>{isUser ? 'You' : 'Assistant'}</div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{msg.content}</p>
        </div>
    );
  };
  
  const renderPreviewPanel = () => (
    <div className="relative mx-auto w-full h-full rounded-lg border bg-background text-card-foreground shadow-sm flex items-center justify-center">
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
  )

  const renderChatPanel = () => (
    <div className="w-full h-full bg-card border-r flex flex-col">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Chat</span>
        </div>
      </div>
      <ScrollArea className="flex-1 p-3" ref={chatContainerRef}>
          <div className="space-y-4 pr-2">{chatHistory.map(renderMessage)}</div>
          { isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground my-4">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span>Working...</span>
          </div>}
      </ScrollArea>
      <div className="p-3 border-t">
          <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                      <FormItem>
                          <FormControl>
                              <div className="relative">
                                  <Input
                                      placeholder="Ask AI App Forge..."
                                      className="bg-input border-border text-sm pr-10"
                                      {...field}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                                              e.preventDefault();
                                              form.handleSubmit(handleFormSubmit)();
                                          }
                                      }}
                                  />
                                  <Button type="submit" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" disabled={isLoading}>
                                      <CornerDownLeft className="h-3 w-3" />
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
  );
  
  const getCodeContent = (tab: ActiveTab | null) => {
    if (!tab || !generatedCode) return "";
    if (tab === 'main.dart') return generatedCode.mainDart;
    if (tab === 'pubspec.yaml') return generatedCode.pubspec;
    return "";
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between px-4 py-2 bg-card border-b">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <Icons.logo className="h-5 w-5 text-primary" />
            <span>AI App Forge</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
           <Button size="sm" variant="ghost" onClick={() => setIsPreviewMode(!isPreviewMode)}>
              <Code className="w-4 h-4" />
              <span className="sr-only">Toggle Preview Mode</span>
           </Button>
          <Button size="sm" variant="secondary" className="bg-secondary hover:bg-secondary/80">
            <Users className="w-4 h-4 mr-1" />
            Invite
          </Button>
          <Button size="sm" variant="default">
            Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isPreviewMode ? (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={25} minSize={20}>
              {renderChatPanel()}
            </Panel>
            <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20" />
            <Panel defaultSize={75}>
              <div className="p-2 h-full">
                {renderPreviewPanel()}
              </div>
            </Panel>
          </PanelGroup>
        ) : (
        <PanelGroup direction="horizontal">
          {/* Chat Panel */}
          <Panel defaultSize={25} minSize={20}>
            {renderChatPanel()}
          </Panel>
          <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20" />
          {/* File Explorer + Code Editor Panel */}
          <Panel defaultSize={75} minSize={30}>
            <PanelGroup direction="horizontal">
              <Panel defaultSize={25} minSize={20}>
                  <div className="flex h-full flex-col bg-card border-r">
                      <div className="p-3 border-b">
                        <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                              <FileIcon className="w-4 h-4" />
                              <span className="text-sm font-medium">Files</span>
                           </div>
                           <Search className="w-4 h-4 text-muted-foreground" />
                        </div>
                         <Input placeholder="Search files" className="bg-input border-border text-sm h-8" />
                      </div>
                      <ScrollArea className="flex-1 px-2 py-2">
                          <div className="space-y-1">
                              <div className="flex items-center gap-2 p-1 rounded-md text-foreground">
                                  <FolderOpen className="h-4 w-4 text-primary"/>
                                  <span>project</span>
                              </div>
                              <div className="ml-4 flex items-center gap-2 p-1 rounded-md text-foreground">
                                  <FolderOpen className="h-4 w-4 text-primary"/>
                                  <span>lib</span>
                              </div>
                              <button
                                  onClick={() => handleFileClick('main.dart')}
                                  disabled={!generatedCode}
                                  className="w-full text-left ml-8 flex items-center gap-2 p-1 rounded-md text-foreground/80 hover:bg-accent disabled:opacity-50 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                                  data-active={activeTab === 'main.dart'}
                              >
                                  <FileCode className="h-4 w-4 text-muted-foreground"/>
                                  <span>main.dart</span>
                              </button>
                              <button
                                  onClick={() => handleFileClick('pubspec.yaml')}
                                  disabled={!generatedCode}
                                  className="w-full text-left ml-4 flex items-center gap-2 p-1 rounded-md text-foreground/80 hover:bg-accent disabled:opacity-50 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                                  data-active={activeTab === 'pubspec.yaml'}
                              >
                                  <FileCode className="h-4 w-4 text-muted-foreground"/>
                                  <span>pubspec.yaml</span>
                              </button>
                          </div>
                      </ScrollArea>
                      <div className="p-3 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {buildStatus === 'idle' && <>Idle</>}
                            {(buildStatus === 'building' || buildStatus === 'uploading' || buildStatus === 'zipping') && <Loader2 className="w-4 h-4 animate-spin"/>}
                            {buildStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500"/>}
                            {buildStatus === 'error' && <XCircle className="w-4 h-4 text-red-500"/>}
                            <span className="capitalize">{buildStatus}</span>
                        </div>
                    </div>
                  </div>
              </Panel>
              <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20" />
              <Panel defaultSize={75} minSize={30}>
                <div className="h-full flex flex-col bg-card">
                  <Tabs value={activeTab ?? "placeholder"} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="w-full flex-1 flex flex-col">
                      <TabsList className="m-2 bg-background border-b-0 rounded-lg">
                          {openTabs.map(tab => (
                            <TabsTrigger key={tab} value={tab} className="relative pr-8">
                                <FileCode className="mr-2 h-4 w-4"/>
                                {tab}
                                <button onClick={(e) => handleCloseTab(tab, e)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 hover:bg-muted-foreground/20">
                                  <X className="h-3 w-3" />
                                </button>
                            </TabsTrigger>
                          ))}
                           <TabsTrigger value="logs" onClick={() => setActiveTab('logs')}><Terminal className="mr-2 h-4 w-4" />Logs</TabsTrigger>
                           <TabsTrigger value="preview" onClick={() => setActiveTab('preview')} disabled={buildStatus !== 'success'}><Play className="mr-2 h-4 w-4" />Preview</TabsTrigger>
                      </TabsList>
                      
                      <div className="flex-1 overflow-y-auto p-2">
                        {openTabs.length === 0 && activeTab !== 'logs' && activeTab !== 'preview' && (
                           <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
                              <Wand2 className="h-16 w-16 mb-4 text-primary/50" />
                              <h2 className="text-xl font-semibold mb-2 text-foreground">Welcome to AI App Forge</h2>
                              <p>Your generated code will appear here.</p>
                              <p>Describe the app you want to build in the chat to get started.</p>
                            </div>
                        )}

                        {openTabs.map(tab => (
                          <TabsContent key={tab} value={tab} className="m-0 h-full">
                            <CodeDisplay code={getCodeContent(tab) ?? ""} />
                          </TabsContent>
                        ))}
                        
                        <TabsContent value="logs" className="m-0 h-full">
                            <div ref={logContainerRef} className="w-full h-full rounded-lg bg-background text-foreground/80 font-mono text-sm p-4 overflow-y-auto">
                                {buildLogs.length > 0 ? buildLogs.map((log, i) => (
                                    <div key={i} className="whitespace-pre-wrap">{log}</div>
                                )) : <div className="text-muted-foreground">Build logs will appear here when you generate an app.</div>}
                            </div>
                        </TabsContent>
                        <TabsContent value="preview" className="m-0 h-full">
                            {renderPreviewPanel()}
                        </TabsContent>
                      </div>
                  </Tabs>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
        )}
      </div>
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BuildPageContent />
    </Suspense>
  )
}
