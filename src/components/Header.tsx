"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/use-auth";

function navLinkClass(pathname: string, href: string, matchStartsWith = false): string {
  const isActive = matchStartsWith
    ? pathname === href || pathname.startsWith(href + "/")
    : pathname === href;
  return isActive
    ? "font-semibold text-brand-600"
    : "text-gray-600 hover:text-gray-900 transition-colors";
}

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold text-brand-700">
          SoloBackend
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/"
            className={navLinkClass(pathname, "/")}
          >
            Explore
          </Link>

          {isLoading ? (
            <span className="h-8 w-20 animate-pulse rounded bg-gray-200" />
          ) : isAuthenticated ? (
            <>
              <Link
                href="/library"
                className={navLinkClass(pathname, "/library")}
              >
                My Collection
              </Link>
              <Link
                href="/my-bundles"
                className={navLinkClass(pathname, "/my-bundles", true)}
              >
                My Bundles
              </Link>
              <span className="text-gray-400">{user?.email}</span>
              <button
                onClick={() => logout()}
                className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <button
              onClick={() => login()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 transition-colors"
            >
              Sign in
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
