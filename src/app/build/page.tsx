"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Bot, Code, Smartphone, Loader2, Sparkles } from "lucide-react";

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
import { generateFlutterApp } from "@/ai/flows/generate-flutter-app";
import { generateFlutterPreview } from "@/ai/flows/generate-flutter-preview";
import { CodeDisplay } from "@/components/code-display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formSchema = z.object({
  prompt: z
    .string()
    .min(10, { message: "Please describe your app in at least 10 characters." })
    .max(500, { message: "Prompt must not be longer than 500 characters." }),
});

export default function BuildPage() {
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Generating...");
  const [isVaguePrompt, setIsVaguePrompt] = useState(false);
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
    setPreviewImage(null);
    setIsVaguePrompt(false);

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

      setLoadingMessage("Generating Flutter code...");
      const codeResult = await generateFlutterApp({ userPrompt: values.prompt });
      setGeneratedCode(codeResult.flutterCode);

      setLoadingMessage("Creating app preview...");
      const previewResult = await generateFlutterPreview({ flutterCode: codeResult.flutterCode });
      setPreviewImage(previewResult.imageUrl);

    } catch (error) {
      console.error("Error generating app:", error);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description:
          "There was a problem generating your app. Please try again.",
      });
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
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview" disabled={!previewImage && !isLoading}>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="code">
                      <Code className="mr-2 h-4 w-4" />
                      Code
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview">
                    <div className="relative mx-auto mt-6 w-[320px] h-[640px] rounded-[40px] border-[10px] border-slate-800 bg-slate-900 shadow-2xl">
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 rounded-b-2xl bg-slate-800"></div>
                       <div className="w-full h-full rounded-[30px] overflow-hidden bg-background">
                        {isLoading && !previewImage && (
                          <div className="flex flex-col items-center justify-center h-full text-center p-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Generating app preview...</p>
                            <p className="text-sm text-muted-foreground/50">This might take a moment.</p>
                          </div>
                        )}
                        {previewImage && (
                          <Image
                            src={previewImage}
                            alt="Generated app preview"
                            layout="fill"
                            objectFit="cover"
                          />
                        )}
                       </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="code">
                    <div className="space-y-4 mt-6">
                      <CodeDisplay code={generatedCode ?? "Generating code..."} />
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
