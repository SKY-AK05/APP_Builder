import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative py-20 md:py-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 top-0 -z-10 h-full w-full bg-background"
      >
        <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[20%] translate-y-[20%] rounded-full bg-[rgba(12,87,79,0.5)] opacity-50 blur-[80px]"></div>
      </div>

      <div className="container relative text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
            Build Flutter Apps with a Conversation
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            From idea to functional app. Describe what you want to build, and
            our AI will generate the code, turning your vision into reality,
            effortlessly.
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <Button size="lg" asChild>
            <Link href="/build">
              Start Building for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
