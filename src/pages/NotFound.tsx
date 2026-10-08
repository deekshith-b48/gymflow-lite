import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { motion } from "framer-motion";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <header className="flex h-16 items-center border-b border-border px-5 sm:px-8">
        <Wordmark />
      </header>

      <div className="flex flex-1 items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <p className="eyebrow">404</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Nothing is racked here
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            That page does not exist. The desk is still where you left it.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Button asChild>
              <Link to="/dashboard">Open the desk</Link>
            </Button>
            <Button asChild variant="outline" className="shadow-none">
              <Link to="/">Landing page</Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.main>
  );
}
