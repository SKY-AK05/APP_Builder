"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import JSZip from "jszip";
import { ArrowLeft, Bot, Code, FileCode, Play, Loader2, Sparkles, Terminal, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { determineImportantRequirement } from "@/ai/flows/determine-important-requirement";
import { generateFlutterApp, GenerateFlutterAppOutput } from "@/ai/flows/generate-flutter-app";
import { CodeDisplay } from "@/components/code-display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formSchema = z.object({
  prompt: z
    .string()
    .min(10, { message: "Please describe your app in at least 10 characters." })
    .max(500, { message: "Prompt must not be longer than 500 characters." }),
});

type ActiveTab = 'code' | 'preview';
type ActiveCodeTab = 'main.dart' | 'pubspec.yaml';
type BuildStatus = 'idle' | 'zipping' | 'uploading' | 'building' | 'success' | 'error';

const BUILD_SERVER_URL = "/api/flutter-build"; // Replace with your actual build server URL
const LOG_SERVER_URL_BASE = "/logs"; // Replace with your actual log server URL (ws or wss)
const PREVIEW_URL_BASE = "/builds"; // Replace with your actual preview hosting URL

export default function BuildPage() {
  const [generatedCode, setGeneratedCode] = useState<GenerateFlutterAppOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Generating...");
  const [isVaguePrompt, setIsVaguePrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('code');
  const [activeCodeTab, setActiveCodeTab] = useState<ActiveCodeTab>('main.dart');
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle');
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { toast } = useToast();
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [buildLogs]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });
  
  const startBuildProcess = async (code: GenerateFlutterAppOutput) => {
      setBuildStatus('zipping');
      setBuildLogs(['Zipping project files...']);
      const zip = new JSZip();
      zip.file("main.dart", code.mainDart);
      zip.file("pubspec.yaml", code.pubspec);
      
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
            throw new Error(`Build server failed: ${await response.text()}`);
        }
        
        const { buildId } = await response.json();
        setBuildStatus('building');
        setBuildLogs(logs => [...logs, `Build started with ID: ${buildId}`, '---']);
        
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}${LOG_SERVER_URL_BASE}/${buildId}`;

        const socket = new WebSocket(wsUrl);
        socket.onmessage = (event) => {
            const newLog = event.data;
            if (newLog.includes("BUILD_SUCCESS")) {
                setPreviewUrl(`${PREVIEW_URL_BASE}/${buildId}/index.html`);
                setBuildStatus('success');
                setBuildLogs(logs => [...logs, '---', 'Build successful!']);
                socket.close();
            } else if (newLog.includes("BUILD_ERROR")) {
                setBuildStatus('error');
                setBuildLogs(logs => [...logs, '---', 'Build failed.']);
                socket.close();
            }
            else {
                setBuildLogs(logs => [...logs, newLog]);
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            setBuildStatus('error');
            setBuildLogs(logs => [...logs, '---', 'Error connecting to build logs.']);
        };
        socket.onclose = () => {
             if(buildStatus !== 'success' && buildStatus !== 'error') {
                setBuildStatus('error');
                setBuildLogs(logs => [...logs, '---', 'Connection to build logs closed.']);
             }
        };

      } catch (error: any) {
          setBuildStatus('error');
          setBuildLogs(logs => [...logs, '---', `An error occurred: ${error.message}`]);
      }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setGeneratedCode(null);
    setIsVaguePrompt(false);
    setBuildStatus('idle');
    setBuildLogs([]);
    setPreviewUrl(null);
    setActiveTab('code');

    try {
      setLoadingMessage("Analyzing requirements...");
      const requirementCheck = await determineImportantRequirement({
        userRequest: values.prompt,
      });

      if (!requirementCheck.hasImportantRequirement) {
        setIsVaguePrompt(true);
        setIsLoading(false);
        return;
      }

      setLoadingMessage("Generating Flutter project...");
      const codeResult = await generateFlutterApp({ userPrompt: values.prompt });
      setGeneratedCode(codeResult);
      setActiveTab('code');
      setActiveCodeTab('main.dart');
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
      setIsLoading(false);
    }
  }

  const renderBuildStatus = () => {
    switch(buildStatus) {
        case 'zipping': return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Zipping...</>
        case 'uploading': return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
        case 'building': return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building...</>
        case 'success': return <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />Build Succeeded</>
        case 'error': return <><XCircle className="mr-2 h-4 w-4 text-red-500" />Build Failed</>
        default: return null
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
        <Button variant="outline" size="icon" className="h-8 w-8" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Home</span>
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">AI App Builder</h1>
      </header>
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tighter">Describe Your App</h2>
            <p className="text-muted-foreground mt-2">
              Tell our AI what your Flutter app should do. Be as specific as possible for the best results.
            </p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'Build a simple todo list app with a button to add tasks and a list to display them.'"
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

          <div className="mt-8">
            {isVaguePrompt && (
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertTitle>AI Tip</AlertTitle>
                <AlertDescription>
                  Your request is a bit vague. Try adding more specific details about features or functionality for a better result.
                </AlertDescription>
              </Alert>
            )}
            {(generatedCode || isLoading || buildStatus !== 'idle') && !isVaguePrompt && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-semibold mb-4">Source Code</h3>
                    {isLoading && !generatedCode ? (
                        <div className="space-y-4 mt-6">
                            <CodeDisplay code={"Generating project files..."} />
                        </div>
                    ) : (
                    <Tabs value={activeCodeTab} onValueChange={(value) => setActiveCodeTab(value as ActiveCodeTab)} className="w-full">
                        <TabsList>
                            <TabsTrigger value="main.dart"><FileCode className="mr-2 h-4 w-4"/>main.dart</TabsTrigger>
                            <TabsTrigger value="pubspec.yaml"><FileCode className="mr-2 h-4 w-4"/>pubspec.yaml</TabsTrigger>
                        </TabsList>
                        <TabsContent value="main.dart">
                            <CodeDisplay code={generatedCode?.mainDart ?? ""} />
                        </TabsContent>
                            <TabsContent value="pubspec.yaml">
                            <CodeDisplay code={generatedCode?.pubspec ?? ""} />
                        </TabsContent>
                    </Tabs>
                    )}
                </div>
                <div>
                     <h3 className="text-xl font-semibold mb-4">Build & Preview</h3>
                     <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="logs">
                                <Terminal className="mr-2 h-4 w-4" />
                                Logs
                            </TabsTrigger>
                            <TabsTrigger value="preview" disabled={buildStatus !== 'success'}>
                                <Play className="mr-2 h-4 w-4" />
                                Preview
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="logs">
                            <div className="relative mt-2 w-full h-[480px] rounded-lg border bg-slate-900 text-slate-100 font-mono text-sm">
                                <div className="absolute top-2 left-4 flex items-center gap-2">
                                    {renderBuildStatus()}
                                </div>
                                <div ref={logContainerRef} className="p-4 pt-10 h-full overflow-y-auto">
                                    {buildLogs.map((log, i) => (
                                        <div key={i} className="whitespace-pre-wrap">{log}</div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="preview">
                            <div className="relative mx-auto mt-2 w-full h-[480px] rounded-lg border bg-card text-card-foreground shadow-sm flex items-center justify-center">
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
                    </Tabs>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
