import { useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { useEditMode } from "@/hooks/use-edit-mode";

export function AdminBar() {
  const { user, isAdmin, loading } = useAdmin();
  const { editMode, setEditMode } = useEditMode();
  const navigate = useNavigate();

  if (loading || !user || !isAdmin) return null;

  const signOut = async () => {
    await supabase.auth.signOut();
    setEditMode(false);
    navigate({ to: "/" });
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] bg-black text-white text-sm flex items-center justify-between px-4 py-2 shadow-lg"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">Admin</span>
        <span className="text-neutral-400 text-xs hidden sm:inline">{user.email}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs">Edit mode</span>
          <input
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
