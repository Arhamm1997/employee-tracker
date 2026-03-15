import { RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "./routes";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";
import { SocketProvider } from "./lib/socket-context";
import { SubscriptionProvider } from "./lib/subscription-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <SubscriptionProvider>
              <RouterProvider router={router} />
              <Toaster
                position="top-right"
                richColors
                toastOptions={{
                  style: {
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--card-foreground)",
                  },
                }}
              />
            </SubscriptionProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
