import { useSearchParams } from "react-router-dom";
import Desktop from "@/components/desktop/Desktop";
import "@/styles/desktop.css";

const Index = () => {
  const [params] = useSearchParams();
  return <Desktop initialApp={params.get("app") ?? undefined} initialCollection={params.get("collection") ?? undefined} />;
};

export default Index;
