import { Bot, Code, Rocket, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: <Bot className="h-8 w-8 text-primary" />,
    title: "Conversational Building",
    description: "Simply chat with our AI in natural language. Describe your app's features, and watch it come to life.",
  },
  {
    icon: <Code className="h-8 w-8 text-primary" />,
    title: "Flutter Code Generation",
    description: "Receive clean, production-ready Flutter code that you can immediately use and customize for your projects.",
  },
  {
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "Intelligent Suggestions",
    description: "Our AI provides smart recommendations to enhance your app's functionality and user experience.",
  },
  {
    icon: <Rocket className="h-8 w-8 text-primary" />,
    title: "Rapid Prototyping",
    description: "Go from concept to a working prototype in minutes, not weeks. Perfect for testing new ideas quickly.",
  },
];

export function Features() {
  return (
    <section className="py-20 md:py-28 bg-card/20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
            A Smarter Way to Build
          </h2>
          <p className="mt-4 text-muted-foreground">
            AI App Forge streamlines development with powerful, intuitive features designed for efficiency and creativity.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/50 bg-card/50 transition-all hover:border-primary/50 hover:bg-card">
              <CardHeader>
                {feature.icon}
                <CardTitle className="mt-4">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
