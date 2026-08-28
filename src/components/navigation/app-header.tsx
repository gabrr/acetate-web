"use client";

import { browserAuth } from "@/auth/browser";
import { PRODUCT } from "@/config/product";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./app-header.module.css";
import { Flex } from "@chakra-ui/react";
import { ChartIcon, ClockIcon } from "../icons/icons";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard", Icon: ChartIcon },
  { href: "/processes", label: "Processes", Icon: ClockIcon },
] as const;

const publicPaths = new Set(["/login", "/auth/confirm"]);

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAccountOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAccountOpen]);

  if (publicPaths.has(pathname)) return null;

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await browserAuth.signOut();
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.navigation} data-product-navigation>
        <Link
          className={styles.brand}
          href="/dashboard"
          aria-label={`${PRODUCT.name} dashboard`}
        >
          <Image
            className={styles.brandLockup}
            src="/brand/acetate-horizontal.svg"
            alt={PRODUCT.name}
            width={446}
            height={90}
            priority
          />
        </Link>

        <nav className={styles.productLinks} aria-label="Product navigation">
          {navigationItems.map((item) => {
            const { Icon } = item;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                <Flex gap={2} justifyContent={"center"} alignItems={"center"}>
                  <Icon />
                  {item.label}
                </Flex>
              </Link>
            );
          })}
        </nav>

        <div className={styles.accountContainer} ref={accountRef}>
          <button
            ref={accountButtonRef}
            className={styles.account}
            type="button"
            aria-expanded={isAccountOpen}
            aria-haspopup="menu"
            onClick={() => setIsAccountOpen((open) => !open)}
          >
            <span className={styles.avatar} aria-hidden="true">
              GW
            </span>
            <span className={styles.accountCopy}>
              <strong>Gabriel Welzel</strong>
              <span>Settings</span>
            </span>
          </button>

          {isAccountOpen ? (
            <div className={styles.accountMenu} role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={isSigningOut}
                onClick={handleSignOut}
              >
                {isSigningOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}
