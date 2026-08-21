import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
          Страницата не постои
        </h1>
        <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
          Вратете се на почетната страница.
        </p>
        <div className="mt-7">
          <Link
            to="/"
            className="block min-h-14 w-full rounded-xl bg-primary px-5 py-4 text-xl font-black text-primary-foreground"
          >
            Почетна страница
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
          Страницата не се вчита
        </h1>
        <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
          Проверете го интернетот и обидете се повторно.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="min-h-14 w-full rounded-xl bg-primary px-5 py-4 text-xl font-black text-primary-foreground"
          >
            Обиди се повторно
          </button>
          <a
            href="/"
            className="min-h-14 w-full rounded-xl border-2 border-border bg-card px-5 py-4 text-xl font-bold text-card-foreground"
          >
            Почетна страница
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Манчестер Јунајтед на македонски" },
      {
        name: "description",
        content: "Резултати, распоред, табела и вести за Манчестер Јунајтед на македонски јазик.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#a01a1a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Јунајтед" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="mk">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
