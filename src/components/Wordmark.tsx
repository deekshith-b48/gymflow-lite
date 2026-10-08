import { Link } from "react-router";

/**
 * The product wordmark: a single ink square and the name set in small caps.
 * Used identically in the landing nav, the auth card and the desk sidebar so
 * the brand never shifts between screens.
 */
export function Wordmark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5">
      <span className="size-2.5 rounded-[3px] bg-foreground transition-transform duration-300 group-hover:rotate-45" />
      <span className="font-mono text-[13px] font-medium uppercase tracking-[0.3em] text-foreground">
        Rack
      </span>
    </Link>
  );
}
