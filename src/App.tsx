import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToAnchor from "./components/ScrollToAnchor";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/DesktopNotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ScrollToAnchor />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/photos" element={<Navigate replace to="/?app=atlas" />} />
          <Route path="/friend" element={<Navigate replace to="/?app=connect" />} />
          <Route path="/daily" element={<Navigate replace to="/?app=daily" />} />
          <Route path="/study" element={<Navigate replace to="/?app=notes" />} />
          <Route path="/photography" element={<Navigate replace to="/?app=photos" />} />
          <Route path="/gaming" element={<Navigate replace to="/?app=games" />} />
          <Route path="/music" element={<Navigate replace to="/?app=music" />} />
          <Route path="/film" element={<Navigate replace to="/?app=cinema" />} />
          <Route path="/food" element={<Navigate replace to="/?app=food" />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
