import { Link } from "@tanstack/react-router";

export default function Header() {
  return (
    <header className="py-4 flex items-center md:items-baseline gap-4">
      <h1 className="text-xl flex-none font-semibold">
        <Link to="/">Ticket Please</Link>
      </h1>
      <p className="text-sm text-neutral-800 flex-1">
        Waiting list and slot managment system
      </p>
      <nav>
        <Link
          to="/me"
          className="text-sm text-neutral-700 hover:text-neutral-900 underline"
        >
          My Profile
        </Link>
      </nav>
    </header>
  );
}
