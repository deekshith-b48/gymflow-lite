import { Link } from "react-router";

/**
 * The GymNetic mark: one lime signal square and the name set in small caps,
 * identical on the landing page, the auth card and the workspace rail.
 */
export function Wordmark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5">
      <span className="relative flex size-3 items-center justify-center">
        <span className="absolute inset-0 rounded-[3px] bg-primary transition-transform duration-300 group-hover:rotate-45" />
        <span className="absolute inset-0 rounded-[3px] bg-primary/40 blur-[6px]" />
      </span>
      <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground">
        Gym<span className="text-primary">Netic</span>
      </span>
    </Link>
  );
}
