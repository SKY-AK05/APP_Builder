"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Bot, Code, FileCode, Play, Loader2, Sparkles } from "lucide-react";

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

export default function BuildPage() {
  const [generatedCode, setGeneratedCode] = useState<GenerateFlutterAppOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Generating...");
  const [isVaguePrompt, setIsVaguePrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('code');
  const [activeCodeTab, setActiveCodeTab] = useState<ActiveCodeTab>('main.dart');
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setGeneratedCode(null);
    setIsVaguePrompt(false);
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
    } finally {
      setIsLoading(false);
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
        <div className="mx-auto max-w-2xl">
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
            {(generatedCode || isLoading) && !isVaguePrompt && (
              <div className="mt-8">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="code">
                      <Code className="mr-2 h-4 w-4" />
                      Code
                    </TabsTrigger>
                    <TabsTrigger value="preview" disabled={!generatedCode}>
                      <Play className="mr-2 h-4 w-4" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="code">
                     <div className="space-y-4 mt-6">
                       {isLoading && !generatedCode ? (
                         <CodeDisplay code={"Generating project files..."} />
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
                  </TabsContent>
                  <TabsContent value="preview">
                    <div className="relative mx-auto mt-6 w-full h-[640px] rounded-lg border bg-card text-card-foreground shadow-sm flex items-center justify-center">
                       <div className="text-center p-4">
                          <Play className="mx-auto h-12 w-12 text-muted-foreground" />
                          <h3 className="mt-4 text-lg font-semibold">Live Preview</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            A live, interactive preview of your app will appear here once the build service is integrated.
                          </p>
                       </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
