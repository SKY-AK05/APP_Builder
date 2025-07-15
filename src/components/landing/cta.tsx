import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-20 md:py-28 bg-card/20">
      <div className="container text-center">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
          Ready to Forge Your App?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Unleash your creativity and build powerful Flutter applications faster
          than ever. No credit card required.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" asChild>
            <Link href="/build">
              Start Building Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
