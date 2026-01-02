import { Link } from "@tanstack/react-router";

import { useState } from "react";
import { Home, Menu, X } from "lucide-react";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="py-4 flex items-baseline gap-4">
      <h1 className="text-xl font-semibold">
        <Link to="/">Ticket Please</Link>
      </h1>
      <p className="text-sm text-neutral-800">Waiting list and slot managment system</p>
    </header>
  );
}
