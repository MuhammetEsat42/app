import { Link } from "react-router-dom";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Ghost } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gb-bg flex items-center justify-center p-6">
      <div className="absolute inset-0 gb-grid opacity-40" />
      <div className="relative text-center gb-fade-up">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Ghost size={48} className="text-gb-glow mx-auto mb-4" />
        <h1 className="text-5xl font-extrabold text-white">404</h1>
        <p className="text-slate-400 mt-2 mb-6">This route drifted off the grid.</p>
        <Link to="/workspace">
          <Button className="bg-gb-violet hover:bg-gb-hover text-white rounded-xl">Back to Workspace</Button>
        </Link>
      </div>
    </div>
  );
}
