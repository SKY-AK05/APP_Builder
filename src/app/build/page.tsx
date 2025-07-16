"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import JSZip from "jszip";
import { ArrowLeft, Bot, FileCode, Play, Loader2, Sparkles, Terminal, CheckCircle2, XCircle, Wand2, Folder, File as FileIcon, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
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
  ResizablePanelGroup,
  ResizablePanel,
  PanelResizeHandle,
} from "@/components/ui/resizable";

const formSchema = z.object({
  prompt: z
    .string()
    .min(10, { message: "Please describe your app in at least 10 characters." })
    .max(500, { message: "Prompt must not be longer than 500 characters." }),
});

type ActiveTab = 'main.dart' | 'pubspec.yaml' | 'logs' | 'preview';
type BuildStatus = 'idle' | 'zipping' | 'uploading' | 'building' | 'success' | 'error';

const BUILD_SERVER_URL = "http://localhost:3001/api/flutter-build"; 
const PREVIEW_URL_BASE = "http://localhost:3001/builds"; 

const examplePrompts = [
  {
    title: "Todo List App",
    prompt: "A simple todo list app where users can add tasks, mark them as complete by tapping, and delete them. Completed tasks should look different from pending tasks."
  },
  {
    title: "Pomodoro Timer",
    prompt: "A minimalist Pomodoro timer app with start, stop, and reset buttons. It should have a visual timer and a way to customize work and break durations."
  },
  {
    title: "Recipe App",
    prompt: "A recipe app that shows a list of recipes. Tapping a recipe opens a detail view with ingredients and instructions. Use placeholder images for recipe photos."
  },
   {
    title: "Calculator",
    prompt: "A basic calculator app with standard arithmetic operations (add, subtract, multiply, divide). It should have a clean interface with a display screen and number/operator buttons."
  }
];

export default function BuildPage() {
  const [generatedCode, setGeneratedCode] = useState<GenerateFlutterAppOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Generating...");
  const [isVaguePrompt, setIsVaguePrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('main.dart');
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle');
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { toast } = useToast();
  const logContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "A simple todo list app where users can add tasks, mark them as complete by tapping, and delete them. Completed tasks should look different from pending tasks.",
    },
  });

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [buildLogs]);

  const handleExamplePromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
  };
  
  const startBuildProcess = async (code: GenerateFlutterAppOutput) => {
      setBuildStatus('zipping');
      setBuildLogs(['Zipping project files...']);
      const zip = new JSZip();
      
      const projectFolder = zip.folder("project");
      if (!projectFolder) {
        setBuildStatus('error');
        setBuildLogs(logs => [...logs, '---', `An error occurred: Failed to create zip folder.`]);
        return;
      }
      projectFolder.file("lib/main.dart", code.mainDart);
      projectFolder.file("pubspec.yaml", code.pubspec);
      
      try {
        const content = await zip.generateAsync({ type: "blob" });
        setBuildStatus('uploading');
        setBuildLogs(logs => [...logs, 'Uploading to build server...']);
        
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
                    socket.close();
                } else if (message.includes("BUILD_ERROR")) {
                    setBuildStatus('error');
                    setBuildLogs(logs => [...logs, '---', 'Build failed. See logs for details.']);
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
        };

        socket.onclose = () => {
            console.log("WebSocket connection closed.");
             if(buildStatus !== 'success' && buildStatus !== 'error') {
                setBuildStatus('error');
                setBuildLogs(logs => [...logs, '---', 'Connection to build logs closed unexpectedly.']);
             }
        };

      } catch (error: any) {
          setBuildStatus('error');
          setBuildLogs(logs => [...logs, '---', `An error occurred: ${error.message}`]);
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

    try {
      setLoadingMessage("Analyzing requirements...");
      const requirementCheck = await determineImportantRequirement({
        userRequest: values.prompt,
      });

      if (!requirementCheck.hasImportantRequirement) {
        setIsVaguePrompt(true);
        setIsGenerating(false);
        return;
      }

      setLoadingMessage("Generating Flutter project...");
      const codeResult = await generateFlutterApp({ userPrompt: values.prompt });
      setGeneratedCode(codeResult);
      setActiveTab('main.dart');
      
      startBuildProcess(codeResult);

    } catch (error: any) {
      console.error("Error generating app:", error);
      const errorMessage = error.message || "An unknown error occurred.";

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
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="flex h-full flex-col p-4 gap-4">
            <h2 className="text-xl font-semibold">Describe Your App</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>App Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., 'A simple todo list app...'"
                          className="min-h-[120px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {loadingMessage}
                    </>
                    ) : (
                    <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate App
                    </>
                    )}
                </Button>
              </form>
            </Form>
            
            <div className="space-y-2 mt-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Or try an example</h3>
                <div className="flex flex-col items-start gap-2">
                {examplePrompts.map((example) => (
                    <Button 
                    key={example.title}
                    variant="link"
                    size="sm"
                    onClick={() => handleExamplePromptClick(example.prompt)}
                    className="text-primary p-0 h-auto"
                    >
                    {example.title}
                    </Button>
                ))}
                </div>
            </div>

             {isVaguePrompt && (
              <Alert variant="destructive" className="mt-4">
                <Bot className="h-4 w-4" />
                <AlertTitle>AI Tip</AlertTitle>
                <AlertDescription>
                  Your request is a bit vague. Try adding more specific details for a better result.
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-auto border-t border-slate-800 pt-4">
                <h3 className="text-lg font-semibold mb-2">Files</h3>
                <div className="relative">
                    <Input placeholder="Search Files" className="pl-8"/>
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 p-1 rounded-md">
                        <Folder className="h-4 w-4"/>
                        <span>project</span>
                    </div>
                     <div className="ml-4 flex items-center gap-2 p-1 rounded-md">
                        <Folder className="h-4 w-4"/>
                        <span>lib</span>
                    </div>
                     <button
                        onClick={() => setActiveTab('main.dart')}
                        disabled={!generatedCode}
                        className="w-full text-left ml-8 flex items-center gap-2 p-1 rounded-md hover:bg-slate-800 disabled:opacity-50"
                     >
                        <FileIcon className="h-4 w-4"/>
                        <span>main.dart</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('pubspec.yaml')}
                        disabled={!generatedCode}
                        className="w-full text-left ml-4 flex items-center gap-2 p-1 rounded-md hover:bg-slate-800 disabled:opacity-50"
                     >
                        <FileIcon className="h-4 w-4"/>
                        <span>pubspec.yaml</span>
                    </button>
                </div>
            </div>
          </div>
        </ResizablePanel>
        <PanelResizeHandle withHandle />
        <ResizablePanel defaultSize={75} minSize={30}>
            <div className="h-full flex flex-col">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="w-full flex-1 flex flex-col">
                    <TabsList className="m-2">
                        <TabsTrigger value="main.dart" disabled={!generatedCode}><FileCode className="mr-2 h-4 w-4"/>main.dart</TabsTrigger>
                        <TabsTrigger value="pubspec.yaml" disabled={!generatedCode}><FileCode className="mr-2 h-4 w-4"/>pubspec.yaml</TabsTrigger>
                        <TabsTrigger value="logs"><Terminal className="mr-2 h-4 w-4" />Logs</TabsTrigger>
                        <TabsTrigger value="preview" disabled={buildStatus !== 'success'}><Play className="mr-2 h-4 w-4" />Preview</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-y-auto p-2">
                        <TabsContent value="main.dart" className="m-0 h-full">
                            <CodeDisplay code={generatedCode?.mainDart ?? "/*\n * Your generated main.dart code will appear here.\n * Describe your app on the left and click 'Generate App'.\n */"} />
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
