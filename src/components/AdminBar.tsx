import { useNavigate, Link } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useAiLanguage } from "@/hooks/use-ai-language";

export function AdminBar() {
  const { user, isAdmin, loading } = useAdmin();
  const { editMode, setEditMode } = useEditMode();
  const { lang: aiLang, setLang: setAiLang } = useAiLanguage();
  const navigate = useNavigate();

  if (loading || !user || !isAdmin) return null;

  const signOut = async () => {
    await supabase.auth.signOut();
    setEditMode(false);
    navigate({ to: "/" });
  };

  return (
    <div
      data-testid="admin-bar"
      className="fixed top-0 left-0 right-0 z-[100] bg-black text-white text-sm flex items-center justify-between px-4 py-2 shadow-lg"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">Admin</span>
        <span className="text-neutral-400 text-xs hidden sm:inline">{user.email}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/" className="text-xs px-2 py-0.5 border border-white/40 rounded hover:bg-white/10">← Site</Link>
        <Link to="/admin/seo" className="text-xs hover:underline">SEO</Link>
        <Link to="/admin/analytics" className="text-xs hover:underline">Analytics</Link>
        <Link to="/admin/performance" className="text-xs hover:underline">Performance</Link>
        <Link to="/admin/contacts" className="text-xs hover:underline">Messages</Link>
        <Link to="/admin/hero" className="text-xs hover:underline">Hero</Link>
        <Link to="/admin/galleries" className="text-xs hover:underline">Galleries</Link>
        <Link to="/admin/assets" className="text-xs hover:underline">Assets</Link>
        <Link to="/admin/storage-cleanup" className="text-xs hover:underline">Cleanup</Link>
        <Link to="/admin/socials" className="text-xs hover:underline">Socials</Link>
        
        <Link to="/admin/theme" className="text-xs hover:underline">Theme</Link>
        <label className="flex items-center gap-1 select-none">
          <span className="text-xs">AI</span>
          <select
            value={aiLang}
            onChange={(e) => setAiLang(e.target.value === "ro" ? "ro" : "en")}
            title="Language used by all AI text features"
            className="text-xs bg-black border border-white/30 rounded px-1 py-0.5"
          >
            <option value="en">EN</option>
            <option value="ro">RO</option>
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs">Edit mode</span>
          <input
            data-testid="edit-mode-toggle"
            type="checkbox"
            checked={editMode}
            onChange={(e) => setEditMode(e.target.checked)}
            className="accent-white"
          />
        </label>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1 border border-white/30 rounded hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
